import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { notifyCustomer } from '../../shared/customerNotify.ts';

// Admin-only: converts a CaseLead into an active recovery case. Creates a Load
// (draft, pre-filled from the lead with sensible defaults the founder refines)
// and a draft Claim linked to it, marks the lead "reviewing", and texts the
// customer that their file is open. The customer has no portal — this SMS is
// their first recovery update.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { leadId } = await req.json().catch(() => ({}));
    if (!leadId) return Response.json({ error: 'leadId required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.CaseLead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    const freeHours = 2;
    const rate = 50;
    const billable = Math.max(0, (Number(lead.hours) || 0) - freeHours);
    const claimAmount = billable * rate;

    const load = await base44.asServiceRole.entities.Load.create({
      broker_name: lead.broker,
      customer_name: lead.name,
      customer_phone: lead.phone,
      load_number: 'TBD',
      free_detention_hours: freeHours,
      detention_rate_per_hour: rate,
      contract_rate: rate,
      total_wait_hours: Number(lead.hours) || 0,
      billable_hours: billable,
      claim_amount: claimAmount,
    });

    const claim = await base44.asServiceRole.entities.Claim.create({
      load_id: load.id,
      broker_name: lead.broker,
      load_number: 'TBD',
      status: 'draft',
      claim_amount: claimAmount,
      generated_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.CaseLead.update(leadId, {
      status: 'reviewing',
      last_message_at: new Date().toISOString(),
      last_message_body: 'Case opened — recovery started.',
    });

    await notifyCustomer(
      base44,
      load.id,
      `Good news ${String(lead.name).split(' ')[0]} — I've opened your detention recovery file against ${lead.broker}. I'll contact the broker now and text you when they reply. — Detention Shield`
    ).catch(() => null);

    return Response.json({ success: true, loadId: load.id, claimId: claim.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});