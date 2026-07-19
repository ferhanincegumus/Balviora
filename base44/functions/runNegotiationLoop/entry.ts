import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id, auto_send } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id is required' }, { status: 400 });

    const claim = await base44.entities.Claim.get(claim_id);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });

    // Need a broker response to negotiate against.
    if (!claim.broker_response || !String(claim.broker_response).trim()) {
      return Response.json({ error: 'No broker response recorded yet. Paste the broker reply first.' }, { status: 400 });
    }

    let load = null;
    if (claim.load_id) {
      try { load = await base44.entities.Load.get(claim.load_id); } catch (_) { load = null; }
    }
    let carrier = null;
    try { const cs = await base44.entities.CarrierProfile.list(); carrier = cs[0] || null; } catch (_) { carrier = null; }

    // Broker history for this carrier (same broker) — informs tone and counter strategy.
    let brokerClaims = [];
    try {
      const all = await base44.entities.Claim.list('-updated_date', 200);
      brokerClaims = all.filter((c) => (c.broker_name || '').trim() === (claim.broker_name || '').trim());
    } catch (_) { brokerClaims = []; }
    const deniedCount = brokerClaims.filter((c) => c.status === 'denied').length;
    const partialCount = brokerClaims.filter((c) => c.status === 'partially_approved').length;
    const paidCount = brokerClaims.filter((c) => c.status === 'paid').length;

    const fmt = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : v);

    const ctx = [
      'CARRIER: ' + (carrier && carrier.company_name || 'N/A'),
      'BROKER: ' + (claim.broker_name || 'N/A'),
      'LOAD NUMBER: ' + (claim.load_number || 'N/A'),
      'ORIGINAL CLAIM AMOUNT: $' + (claim.claim_amount || 0),
      'BILLABLE HOURS: ' + fmt(load && load.billable_hours, 'N/A'),
      'FREE DETENTION HOURS: ' + fmt(load && load.free_detention_hours, 2),
      'DETENTION RATE: $' + fmt(load && load.detention_rate_per_hour, 50) + '/hr',
      'ARRIVAL: ' + fmt(load && load.arrival_time, 'N/A'),
      'DEPARTURE: ' + fmt(load && load.departure_time, 'N/A'),
      'BROKER OFFER AMOUNT: $' + fmt(claim.broker_offer_amount, 0),
      'CURRENT CLAIM STATUS: ' + claim.status,
      'NEGOTIATION ROUND (this will be round ' + ((claim.negotiation_rounds || 0) + 1) + '): ' + (claim.negotiation_rounds || 0),
      'BROKER HISTORY (same broker): ' + brokerClaims.length + ' claims, ' + deniedCount + ' denied, ' + partialCount + ' partial, ' + paidCount + ' paid',
      'BROKER RESPONSE TO ANALYZE:',
      String(claim.broker_response).slice(0, 3000)
    ].join('\n');

    const ai = await base44.integrations.Core.InvokeLLM({
      prompt:
        'You are an expert freight detention claim negotiator running an automated negotiation loop. ' +
        'A broker has responded to a carrier detention claim. Analyze the broker response and craft the optimal counter-argument reply.\n\n' +
        'CLAIM CONTEXT:\n' + ctx + '\n\n' +
        'Tasks:\n' +
        '1. analysis: in 1-2 sentences, what is the broker actually saying/asking (e.g. lowball, request for docs, denial, delay)?\n' +
        '2. intent: classify as one of: lowball, documentation_request, denial, delay, partial_approval, acceptance, other.\n' +
        '3. recommended_counter_amount: the dollar amount the carrier should counter at (number). If the broker denied outright, counter at the full claim amount. If a lowball, counter at full. If partial, counter at full or a small concession. Use the claim amount as the ceiling.\n' +
        '4. should_accept: boolean — true if the broker offer meets or exceeds a reasonable floor (>= 75% of claim when evidence is strong).\n' +
        '5. next_action: one short recommended action for the carrier (e.g. "Counter at full amount", "Send BOL + POD", "Accept offer").\n' +
        '6. reply_subject: a clear email subject referencing the load number and "Detention Claim".\n' +
        '7. reply_body: a professional, firm counter-argument email body (plain text with line breaks). Address the broker response directly, cite documented detention facts, and state the requested amount. Do not accept below 75% of the claim unless should_accept is true. Sign with the carrier company name.\n\n' +
        'Return JSON only.',
      response_json_schema: {
        type: 'object',
        properties: {
          analysis: { type: 'string' },
          intent: { type: 'string' },
          recommended_counter_amount: { type: 'number' },
          should_accept: { type: 'boolean' },
          next_action: { type: 'string' },
          reply_subject: { type: 'string' },
          reply_body: { type: 'string' }
        }
      }
    });

    const newRounds = (claim.negotiation_rounds || 0) + 1;
    const update = {
      negotiation_rounds: newRounds,
      ai_next_action: ai.next_action || '',
      last_loop_reply_subject: ai.reply_subject || '',
      last_loop_reply_body: ai.reply_body || '',
      response_date: claim.response_date || new Date().toISOString(),
      status: 'awaiting_response',
    };

    let sent = false;
    let sendError = null;
    if (auto_send) {
      update.email_subject = ai.reply_subject || claim.email_subject || '';
      update.email_body = ai.reply_body || claim.email_body || '';
      update.last_followup_date = new Date().toISOString();
      update.next_followup_date = new Date(Date.now() + 4 * 86400000).toISOString();
      try {
        await base44.functions.invoke('sendClaimEmail', { claimId: claim_id });
        update.status = 'sent';
        update.sent_date = new Date().toISOString();
        sent = true;
      } catch (e) {
        sendError = String(e && e.message || e);
      }
    }

    const updated = await base44.entities.Claim.update(claim_id, update);

    return Response.json({
      claim: updated,
      loop: {
        round: newRounds,
        analysis: ai.analysis,
        intent: ai.intent,
        recommended_counter_amount: ai.recommended_counter_amount,
        should_accept: ai.should_accept,
        next_action: ai.next_action,
        reply_subject: ai.reply_subject,
        reply_body: ai.reply_body,
        sent,
        sendError
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});