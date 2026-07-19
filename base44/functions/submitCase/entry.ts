import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendCustomerMessage } from '../../shared/twilio.ts';

// Public endpoint — called from the landing "Send my case" form by visitors
// who are NOT logged in (customers never have accounts). Uses the service role
// to create the lead. A honeypot field ("website") filters bots. A best-effort
// confirmation message is sent to the customer's phone; the lead is saved even
// if messaging isn't provisioned yet.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { name, phone, broker, hours, notes, website } = body;

    // Honeypot: real users never fill the hidden "website" field.
    if (website) return Response.json({ success: true });

    if (!name || !phone || !broker || !hours) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lead = await base44.asServiceRole.entities.CaseLead.create({
      name: String(name).slice(0, 120),
      phone: String(phone).slice(0, 40),
      broker: String(broker).slice(0, 120),
      hours: Number(hours),
      notes: notes ? String(notes).slice(0, 2000) : '',
      status: 'new',
    });

    // Best-effort confirmation; never fail the lead capture over messaging.
    try {
      const first = String(name).split(' ')[0];
      await sendCustomerMessage(
        String(phone),
        `Hi ${first} — I got your detention case against ${broker}. I'll review it and text you within 48 hours. Keep your rate con handy. — Detention Shield`
      );
    } catch {
      /* messaging not configured yet */
    }

    return Response.json({ success: true, leadId: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});