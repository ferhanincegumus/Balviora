import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { notifyCustomer } from '../../shared/customerNotify.ts';

// Sends the claim email to a real broker inbox via the sendEmail provider.
// Draft mode is enforced on the client: nothing is sent until the owner
// clicks "Approve & Send". Every attempt is appended to claim.email_log.
// Reply-To is claims+<claimId>@<inbound domain> so broker replies route back.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { claimId, to } = body;
    if (!claimId) return Response.json({ error: 'claimId required' }, { status: 400 });

    const claim = await base44.entities.Claim.get(claimId);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });
    if (!claim.email_subject || !claim.email_body) {
      return Response.json({ error: 'No claim email generated yet' }, { status: 400 });
    }

    const recipient = (to || claim.broker_contact_email || '').trim();
    if (!recipient) {
      return Response.json({ error: 'No broker email — set a broker contact email before sending.' }, { status: 400 });
    }

    const inboundDomain = Deno.env.get('RESEND_INBOUND_DOMAIN');
    const replyTo = inboundDomain ? `claims+${claim.id}@${inboundDomain}` : undefined;

    const res = await base44.functions.invoke('sendEmail', {
      to: recipient, subject: claim.email_subject, text: claim.email_body, replyTo,
    });
    const result = res?.data || {};
    const status = result.status === 'delivered' ? 'delivered' : 'failed';
    const providerId = result.providerId || null;
    const message = result.message || '';

    const entry = {
      timestamp: new Date().toISOString(),
      recipient, subject: claim.email_subject, status, provider_id: providerId, message, kind: 'claim',
    };
    const log = Array.isArray(claim.email_log) ? claim.email_log : [];
    log.push(entry);
    await base44.entities.Claim.update(claim.id, { email_log: log });

    if (status === 'delivered') {
      await notifyCustomer(
        base44,
        claim.load_id,
        `Update: I've sent your detention claim to ${claim.broker_name || 'the broker'}. Now we wait for their reply — I'll text you when they respond. — Detention Shield`
      ).catch(() => null);
    }

    if (status === 'failed') {
      return Response.json({ error: message || 'Email send failed', log: entry }, { status: 502 });
    }
    return Response.json({ success: true, sentTo: recipient, subject: claim.email_subject, providerId, log: entry });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});