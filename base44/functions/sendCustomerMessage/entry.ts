import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendCustomerMessage } from '../../shared/twilio.ts';

// Admin-only: sends an SMS + WhatsApp update to a customer's phone from the
// Case Leads dashboard. Logs the message onto the lead.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { phone, message, leadId } = body;
    if (!phone || !message) {
      return Response.json({ error: 'phone and message required' }, { status: 400 });
    }

    const result = await sendCustomerMessage(String(phone), String(message).slice(0, 1000));

    if (leadId) {
      try {
        await base44.asServiceRole.entities.CaseLead.update(leadId, {
          last_message_at: new Date().toISOString(),
          last_message_body: String(message).slice(0, 1000),
        });
      } catch {
        /* lead log is best-effort */
      }
    }

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});