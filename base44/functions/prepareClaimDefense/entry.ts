import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id is required' }, { status: 400 });

    const claim = await base44.entities.Claim.get(claim_id);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });

    let load = null;
    if (claim.load_id) {
      try { load = await base44.entities.Load.get(claim.load_id); } catch (_) { load = null; }
    }
    let carrier = null;
    try { const cs = await base44.entities.CarrierProfile.list(); carrier = cs[0] || null; } catch (_) { carrier = null; }
    let followups = [];
    try { followups = await base44.entities.FollowUp.filter({ claim_id }); } catch (_) { followups = []; }

    // Evidence strength scoring grounded in available load/claim fields.
    const evidence = [];
    let score = 0;
    const addEv = (label, present, pts) => {
      const p = !!present;
      evidence.push({ item: label, present: p });
      if (p) score += pts;
    };
    addEv('Appointment confirmation', load && load.appointment_time, 20);
    addEv('Arrival timestamp', load && load.arrival_time, 20);
    addEv('Departure timestamp / POD', load && load.departure_time, 20);
    addEv('Free time exceeded proof', load && (Number(load.billable_hours) || 0) > 0, 15);
    addEv('Driver notes', claim.carrier_notes, 10);
    addEv('Broker acknowledgment', claim.broker_response, 15);
    const riskScore = Math.min(100, score);
    const claimStrength =
      riskScore >= 85 ? 'Very Strong' :
      riskScore >= 70 ? 'Strong' :
      riskScore >= 50 ? 'Moderate' :
      riskScore >= 30 ? 'Weak' : 'Very Weak';

    const fmt = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : v);

    const ctx = [
      'CARRIER: ' + (carrier && carrier.company_name || 'N/A'),
      'BROKER: ' + (claim.broker_name || 'N/A'),
      'LOAD NUMBER: ' + (claim.load_number || 'N/A'),
      'CLAIM AMOUNT: $' + (claim.claim_amount || 0),
      'PICKUP/FACILITY: ' + fmt(load && load.pickup_location, 'N/A'),
      'APPOINTMENT TIME: ' + fmt(load && load.appointment_time, 'Not provided'),
      'ARRIVAL TIME: ' + fmt(load && load.arrival_time, 'Not provided'),
      'DEPARTURE TIME: ' + fmt(load && load.departure_time, 'Not provided'),
      'FREE DETENTION HOURS: ' + fmt(load && load.free_detention_hours, 2),
      'DETENTION RATE PER HOUR: $' + fmt(load && load.detention_rate_per_hour, 50),
      'TOTAL WAIT HOURS: ' + fmt(load && load.total_wait_hours, 'N/A'),
      'BILLABLE HOURS: ' + fmt(load && load.billable_hours, 'N/A'),
      'DRIVER/CARRIER NOTES: ' + fmt(claim.carrier_notes, 'None'),
      'PREVIOUS BROKER RESPONSE: ' + fmt(claim.broker_response, 'None'),
      'BROKER OFFER AMOUNT: $' + fmt(claim.broker_offer_amount, 0),
      'FOLLOW-UPS SENT: ' + followups.length,
      'EVIDENCE STRENGTH SCORE (computed): ' + riskScore + '/100 (' + claimStrength + ')',
      'EVIDENCE AVAILABLE: ' + evidence.filter((e) => e.present).map((e) => e.item).join(', '),
      'EVIDENCE MISSING: ' + evidence.filter((e) => !e.present).map((e) => e.item).join(', ')
    ].join('\n');

    const ai = await base44.integrations.Core.InvokeLLM({
      prompt:
        'You are an expert freight detention claim defense analyst. Analyze this claim and build a broker-proof defense package.\n\n' +
        'CLAIM CONTEXT:\n' + ctx + '\n\n' +
        'Tasks:\n' +
        '1. approval_probability (0-100): likelihood the broker approves this claim, based on evidence strength, documentation, and broker responsiveness.\n' +
        '2. broker_denial_risks: 2-4 likely objections a broker might raise, each with a concrete counter argument citing the available timestamps/evidence (objection + counter).\n' +
        '3. missing_evidence: items that would weaken the claim if not provided.\n' +
        '4. recommended_actions: concrete steps to strengthen the claim before submitting.\n' +
        '5. strongest_arguments: 2-4 strongest points supporting this claim.\n' +
        '6. ai_generated_response: a professional, firm email replying to the broker defending the detention claim. Cite arrival/departure times, free time exceeded, and evidence. Be professional but assertive. Write the email body only (no Subject line, no greeting salutation outside the body).\n\n' +
        'Return JSON only.',
      response_json_schema: {
        type: 'object',
        properties: {
          approval_probability: { type: 'number' },
          broker_denial_risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: { objection: { type: 'string' }, counter: { type: 'string' } }
            }
          },
          missing_evidence: { type: 'array', items: { type: 'string' } },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          strongest_arguments: { type: 'array', items: { type: 'string' } },
          ai_generated_response: { type: 'string' }
        }
      }
    });

    const reportData = {
      claim_id,
      risk_score: riskScore,
      claim_strength: claimStrength,
      approval_probability: ai.approval_probability != null ? ai.approval_probability : riskScore,
      missing_evidence: ai.missing_evidence || [],
      broker_denial_risks: ai.broker_denial_risks || [],
      recommended_actions: ai.recommended_actions || [],
      strongest_arguments: ai.strongest_arguments || [],
      evidence_checklist: evidence,
      ai_generated_response: ai.ai_generated_response || '',
      status: 'generated'
    };

    const existing = await base44.entities.ClaimDefenseReport.filter({ claim_id });
    let report;
    if (existing && existing.length > 0) {
      report = await base44.entities.ClaimDefenseReport.update(existing[0].id, reportData);
    } else {
      report = await base44.entities.ClaimDefenseReport.create(reportData);
    }

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});