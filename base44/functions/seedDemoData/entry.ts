import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// One-tap demo seeder. Runs with the CALLING USER's token (base44.entities
// is user-scoped), so created_by_id = the logged-in owner and the records
// respect RLS and actually show up in their dashboard. Idempotent: skips if
// demo loads already exist.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await base44.entities.Load.list(100);
    const already = (existing || []).filter((l) => (l.load_number || '').startsWith('DS-DEMO'));
    if (already.length >= 10) {
      return Response.json({ success: true, alreadySeeded: true, count: already.length });
    }

    const HOUR = 3600000;
    const DAY = 86400000;
    const now = Date.now();
    const iso = (t) => new Date(t).toISOString();

    // Carrier profile (owner-scoped)
    const company = await base44.entities.Company.create({
      company_name: 'Ironline Transport LLC',
      default_free_hours: 2,
      default_rate_per_hour: 50,
      default_payout_rate_per_hour: 25,
    });

    // Four demo drivers (user_id = owner so RLS read allows them)
    const driverDefs = [
      { name: 'Marcus Reed', truck: 'KW-1001', payout_rate_per_hour: 25, free_detention_hours: 2 },
      { name: 'Dana Whitfield', truck: 'PB-2207', payout_rate_per_hour: 28, free_detention_hours: 2 },
      { name: 'Carlos Mendoza', truck: 'FL-3380', payout_rate_per_hour: 25, free_detention_hours: 2 },
      { name: 'Tasha Brooks', truck: 'VNL-4471', payout_rate_per_hour: 30, free_detention_hours: 1.5 },
    ];
    const drivers = [];
    for (const d of driverDefs) {
      drivers.push(await base44.entities.Driver.create({
        ...d, company_id: company.id, user_id: user.id,
      }));
    }

    // 10 scenarios. billable = max(0, wait - free); claim = billable * rate.
    const scenarios = [
      { num: 'DS-DEMO-1001', broker: 'Apex Logistics', customer: 'Northstar Foods', pickup: 'Joliet, IL', delivery: 'Gary, IN', arrOff: 3 * DAY, depOff: 3 * DAY + 7 * HOUR, apptOff: 3 * DAY - 2 * HOUR, free: 2, rate: 50, contract: 50, drv: 0, clause: true, status: 'sent', sentOff: 2.5 * DAY, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1002', broker: 'Summit Freight', customer: 'Cascade Retail', pickup: 'Sparks, NV', delivery: 'Reno, NV', arrOff: 5 * DAY, depOff: 5 * DAY + 10 * HOUR, apptOff: 5 * DAY - 1.5 * HOUR, free: 2, rate: 60, contract: 75, drv: 1, clause: true, status: 'approved', sentOff: 4 * DAY, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1003', broker: 'Meridian Transport', customer: 'Gulf Coast Produce', pickup: 'Mobile, AL', delivery: 'Pensacola, FL', arrOff: 1 * DAY, depOff: null, apptOff: 1 * DAY - 2 * HOUR, free: 2, rate: 50, contract: 50, drv: 2, clause: true, status: 'draft', sentOff: null, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1004', broker: 'Coastal Carriers', customer: 'Pacific Dry Goods', pickup: 'Long Beach, CA', delivery: 'Ontario, CA', arrOff: 6 * DAY, depOff: 6 * DAY + 4 * HOUR, apptOff: 6 * DAY - 1 * HOUR, free: 2, rate: 50, contract: 50, drv: 0, clause: true, status: null, sentOff: null, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1005', broker: 'Northgate Brokerage', customer: 'Heartland Mfg', pickup: 'Kansas City, MO', delivery: 'Wichita, KS', arrOff: 8 * DAY, depOff: 8 * DAY + 9 * HOUR, apptOff: 8 * DAY - 2 * HOUR, free: 1.5, rate: 55, contract: 55, drv: 3, clause: true, status: 'followup_required', sentOff: 7 * DAY, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1006', broker: 'Bluepeak Logistics', customer: 'Summit Beverage Co', pickup: 'Denver, CO', delivery: 'Colorado Springs, CO', arrOff: 12 * DAY, depOff: 12 * DAY + 6 * HOUR, apptOff: 12 * DAY - 1.5 * HOUR, free: 2, rate: 50, contract: 50, drv: 1, clause: true, status: 'paid', sentOff: 11 * DAY, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1007', broker: 'Riverside Freight', customer: 'Delta Building Supply', pickup: 'Memphis, TN', delivery: 'Nashville, TN', arrOff: 2 * DAY, depOff: 2 * DAY + 5 * HOUR, apptOff: 2 * DAY - 2 * HOUR, free: 2, rate: 50, contract: 50, drv: 2, clause: true, status: 'ready_to_send', sentOff: null, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1008', broker: 'Cardinal Logistics', customer: 'Eastside Warehousing', pickup: 'Columbus, OH', delivery: 'Cleveland, OH', arrOff: 4 * DAY, depOff: 4 * DAY + 12 * HOUR, apptOff: 4 * DAY - 2 * HOUR, free: 2, rate: 50, contract: 65, drv: 3, clause: false, status: 'denied', sentOff: 3 * DAY, claimAmount: null, approved: null, paid: null, denial: 'No detention clause found on rate confirmation', offer: null },
      { num: 'DS-DEMO-1009', broker: 'Evergreen Transport', customer: 'GreenLeaf Foods', pickup: 'Portland, OR', delivery: 'Salem, OR', arrOff: 3 * HOUR, depOff: null, apptOff: 1 * HOUR, free: 2, rate: 50, contract: 50, drv: 0, clause: true, status: null, sentOff: null, claimAmount: null, approved: null, paid: null, denial: null, offer: null },
      { num: 'DS-DEMO-1010', broker: 'Granite State Carriers', customer: 'White Mountain Lumber', pickup: 'Manchester, NH', delivery: 'Concord, NH', arrOff: 9 * DAY, depOff: 9 * DAY + 8 * HOUR, apptOff: 9 * DAY - 2 * HOUR, free: 2, rate: 50, contract: 50, drv: 1, clause: true, status: 'partially_approved', sentOff: 8 * DAY, claimAmount: null, approved: null, paid: null, denial: null, offer: 150 },
    ];

    let loadsCreated = 0;
    let claimsCreated = 0;
    const claimIdsForFollowups = [];

    for (const s of scenarios) {
      const drv = drivers[s.drv];
      const arr = now - s.arrOff;
      const dep = s.depOff != null ? now - s.depOff : null;
      const appt = now - s.apptOff;
      const waitHours = dep != null ? (dep - arr) / HOUR : (now - arr) / HOUR;
      const billable = Math.max(0, Math.round((waitHours - s.free) * 10) / 10);
      const claimAmount = Math.round(billable * s.contract * 100) / 100;

      const load = await base44.entities.Load.create({
        broker_name: s.broker,
        customer_name: s.customer,
        load_number: s.num,
        pickup_location: s.pickup,
        delivery_location: s.delivery,
        appointment_time: iso(appt),
        arrival_time: iso(arr),
        departure_time: dep != null ? iso(dep) : undefined,
        free_detention_hours: s.free,
        detention_rate_per_hour: s.rate,
        contract_rate: s.contract,
        total_wait_hours: Math.round(waitHours * 10) / 10,
        billable_hours: billable,
        claim_amount: claimAmount,
        detention_clause_exists: s.clause,
        company_id: company.id,
        driver_id: drv.id,
        driver_user_id: user.id,
        driver_name: drv.name,
        truck: drv.truck,
        payout_rate_per_hour: drv.payout_rate_per_hour,
      });
      loadsCreated++;

      if (s.status) {
        const claimPayload = {
          load_id: load.id,
          broker_name: s.broker,
          broker_contact_email: `ap@${s.broker.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          load_number: s.num,
          status: s.status,
          claim_amount: claimAmount,
          generated_at: iso(now - s.arrOff),
          email_subject: `Detention claim — ${s.num} (${s.broker})`,
          email_body: `Per rate confirmation for load ${s.num}, driver waited ${Math.round(waitHours * 10) / 10} hrs (${billable} billable at $${s.contract}/hr). Amount due: $${claimAmount.toFixed(2)}.`,
          denial_reason: s.denial || undefined,
          broker_offer_amount: s.offer || undefined,
        };
        if (s.sentOff != null) claimPayload.sent_date = iso(now - s.sentOff);
        if (s.status === 'approved' || s.status === 'partially_approved') claimPayload.approved_amount = s.offer || claimAmount;
        if (s.status === 'paid') { claimPayload.approved_amount = claimAmount; claimPayload.paid_amount = claimAmount; }
        if (s.status === 'followup_required') {
          claimPayload.next_followup_date = iso(now + 1 * DAY);
          claimPayload.last_followup_date = iso(now - 1 * DAY);
        }
        const claim = await base44.entities.Claim.create(claimPayload);
        claimsCreated++;
        if (s.status === 'followup_required' || s.status === 'sent') {
          claimIdsForFollowups.push({ id: claim.id, sentOff: s.sentOff, type: 'day_7' });
        }
      }
    }

    // A couple of scheduled follow-ups for the followup_required claim
    for (const f of claimIdsForFollowups.slice(0, 2)) {
      try {
        await base44.entities.FollowUp.create({
          claim_id: f.id,
          scheduled_date: iso(now + 1 * DAY),
          type: 'day_7',
          status: 'scheduled',
          follow_up_number: 1,
        });
      } catch (e) { /* follow-up optional */ }
    }

    return Response.json({
      success: true,
      company: company.id,
      drivers: drivers.length,
      loads: loadsCreated,
      claims: claimsCreated,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error?.stack }, { status: 500 });
  }
});