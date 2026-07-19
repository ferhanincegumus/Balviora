import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { notifyCustomer } from '../../shared/customerNotify.ts';

// Resend "email.received" inbound webhook. Closes the loop:
//   broker reply -> matched to claim (via claims+<claimId>@domain Reply-To)
//   -> stored (idempotent by message_id) -> AI drafts a suggested reply
//   -> human approves & sends (sendClaimReply).
// Secured by a shared query secret in the webhook URL. Runs as service role.
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') !== Deno.env.get('INBOUND_WEBHOOK_SECRET')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const event = await req.json().catch(() => ({}));
    if (event?.type !== 'email.received' || !event?.data) {
      return Response.json({ ok: true, ignored: true });
    }
    const d = event.data;
    const emailId = d.email_id;
    const messageId = d.message_id || emailId;
    const fromEmail = (d.from || '').toString();
    const toAddrs = Array.isArray(d.to) ? d.to : [];
    const subject = d.subject || '';

    // Match the claim via the Reply-To plus-address: claims+<claimId>@domain
    let claimId = null;
    for (const addr of toAddrs) {
      const m = String(addr).match(/claims\+([0-9a-f]{20,})@/i);
      if (m) { claimId = m[1]; break; }
    }
    if (!claimId) {
      console.log(`[INBOUND] no claim match for to=${toAddrs.join(',')} subject="${subject}"`);
      return Response.json({ ok: true, matched: false });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const claim = await sr.entities.Claim.get(claimId).catch(() => null);
    if (!claim) {
      console.log(`[INBOUND] claim ${claimId} not found`);
      return Response.json({ ok: true, matched: false });
    }

    // Idempotency: skip if we already processed this inbound message_id.
    const replies = Array.isArray(claim.inbound_replies) ? claim.inbound_replies : [];
    if (replies.some((r) => r.message_id === messageId)) {
      return Response.json({ ok: true, duplicate: true });
    }

    // Fetch the full email body from Resend (webhook carries metadata only).
    const apiKey = Deno.env.get('RESEND_API_KEY');
    let bodyText = '';
    if (apiKey && emailId) {
      try {
        const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          bodyText = j.text || '';
          if (!bodyText && j.html) bodyText = j.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch (e) {
        console.log(`[INBOUND] fetch body failed: ${e?.message}`);
      }
    }

    // AI analyzes the broker reply and drafts a suggested response (draft/approve).
    let draftSubject = '';
    let draftBody = '';
    try {
      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `A broker replied to a detention time claim email. Analyze their reply and draft a professional, firm but polite response for the carrier to review and approve.

Claim context:
- Load number: ${claim.load_number || 'N/A'}
- Broker: ${claim.broker_name || 'N/A'}
- Claim amount: $${Number(claim.claim_amount || 0).toFixed(2)}
- Original claim subject: ${claim.email_subject || ''}

Broker reply:
Subject: ${subject}
Body: ${bodyText || '(no body)'}

Draft a reply that:
1. Acknowledges the broker's response.
2. If they offered partial payment or asked for more docs, responds appropriately — accept partial only if it matches the claim; otherwise politely counter with the full amount and restate the documented arrival/departure times, billable hours, and contract rate.
3. If they denied, asks for the specific denial reason in writing and reiterates the documented wait time.
4. Keeps a professional, non-confrontational tone. Short.

Return JSON with "subject" and "body" (plain text with line breaks).`,
        response_json_schema: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } } },
      });
      draftSubject = llm.subject || `Re: ${subject}`;
      draftBody = llm.body || '';
    } catch (e) {
      console.log(`[INBOUND] LLM draft failed: ${e?.message}`);
    }

    const now = new Date().toISOString();
    replies.push({ message_id: messageId, email_id: emailId, from: fromEmail, subject, body: bodyText, received_at: now });

    const updateData = {
      inbound_replies: replies,
      last_loop_reply_subject: subject,
      last_loop_reply_body: bodyText,
      broker_response: bodyText,
      broker_reply_received_at: now,
      response_date: now,
      pending_reply_subject: draftSubject,
      pending_reply_body: draftBody,
      pending_reply_in_reply_to: messageId,
      status: 'awaiting_response',
    };
    if (!claim.broker_contact_email && fromEmail) updateData.broker_contact_email = fromEmail;

    await sr.entities.Claim.update(claim.id, updateData);
    await notifyCustomer(
      base44,
      claim.load_id,
      `Update: ${claim.broker_name || 'the broker'} replied to your detention claim. I'll review it and get back to them — no action needed from you. — Detention Shield`
    ).catch(() => null);
    return Response.json({ ok: true, matched: true, claimId: claim.id, drafted: !!draftBody });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});