import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Sends the human-approved AI draft reply to the broker via the sendEmail
// provider. Draft/approve: nothing is sent until the owner clicks
// "Approve & Send Reply". Threads via In-Reply-To and logs to claim.email_log.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { claimId } = body;
    if (!claimId) return Response.json({ error: 'claimId required' }, { status: 400 });

    const claim = await base44.entities.Claim.get(claimId);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });
    if (!claim.pending_reply_subject || !claim.pending_reply_body) {
      return Response.json({ error: 'No pending reply draft' }, { status: 400 });
    }
    const recipient = (claim.broker_contact_email || '').trim();
    if (!recipient) return Response.json({ error: 'No broker email on claim' }, { status: 400 });

    const headers = {};
    if (claim.pending_reply_in_reply_to) headers['In-Reply-To'] = claim.pending_reply_in_reply_to;

    const res = await base44.functions.invoke('sendEmail', {
      to: recipient,
      subject: claim.pending_reply_subject,
      text: claim.pending_reply_body,
      headers,
    });
    const result = res?.data || {};
    const status = result.status === 'delivered' ? 'delivered' : 'failed';
    const providerId = result.providerId || null;
    const message = result.message || '';

    const entry = {
      timestamp: new Date().toISOString(),
      recipient, subject: claim.pending_reply_subject, status, provider_id: providerId, message, kind: 'reply',
    };
    const log = Array.isArray(claim.email_log) ? claim.email_log : [];
    log.push(entry);

    const updateData = { email_log: log };
    if (status === 'delivered') {
      updateData.pending_reply_subject = '';
      updateData.pending_reply_body = '';
      updateData.pending_reply_in_reply_to = '';
      updateData.last_followup_date = new Date().toISOString();
    }
    await base44.entities.Claim.update(claim.id, updateData);

    if (status === 'failed') {
      return Response.json({ error: message || 'Reply send failed', log: entry }, { status: 502 });
    }
    return Response.json({ success: true, sentTo: recipient, log: entry });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});