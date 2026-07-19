import { computeScore } from "@/lib/claimScore";
import { getDaysWaiting } from "@/lib/followUpEngine";

// Determine the negotiation scenario from the claim + broker response.
export function detectScenario(claim) {
  const resp = (claim.broker_response || "").toLowerCase();
  const offer = Number(claim.broker_offer_amount || 0);
  const amount = Number(claim.claim_amount || 0);

  if (claim.status === "denied" || /den(y|ied)|reject/.test(resp)) return "denial_appeal";
  if (offer > 0 && offer < amount) {
    if (offer < amount * 0.5) return "lowball_counter";
    return "partial_counter";
  }
  if (/document|evidence|proof|bol|bill of lading|timestamp|log|receipt/.test(resp)) return "documentation";
  if (claim.status === "awaiting_response" || (!resp && claim.status === "sent")) return "no_response_escalation";
  return "standard_followup";
}

export const SCENARIO_LABELS = {
  denial_appeal: "Broker denied — appeal with evidence",
  partial_counter: "Broker counter-offered — negotiate up",
  lowball_counter: "Lowball offer — firm counter",
  documentation: "Broker needs documentation",
  no_response_escalation: "No response — escalate",
  standard_followup: "Standard follow-up",
};

// Build a deterministic negotiation strategy from claim + load.
export function buildStrategy(claim, load) {
  const amount = Number(claim.claim_amount || 0);
  const scenario = detectScenario(claim);
  const score = computeScore(claim, load);
  const days = getDaysWaiting(claim);
  const offer = Number(claim.broker_offer_amount || 0);

  // Min acceptable floor rises when detention is well-documented (billable hours present).
  const hasHours = load && Number(load.billable_hours || 0) > 0;
  const minAcceptable = Math.round(amount * (hasHours ? 0.75 : 0.5));

  // Leverage points derived from load documentation.
  const leverage = [];
  if (load?.arrival_time && load?.departure_time) leverage.push("Documented arrival & departure timestamps");
  if (load?.appointment_time) leverage.push("Scheduled appointment time on file");
  if (hasHours) leverage.push(`${Number(load.billable_hours).toFixed(1)} billable hours beyond free time`);
  if (load?.pickup_location && load?.delivery_location) leverage.push("Confirmed pickup & delivery locations");
  if (days >= 7) leverage.push(`${days} days elapsed without resolution`);

  // Tone by scenario + aging.
  let tone = "professional and firm";
  if (scenario === "denial_appeal") tone = "respectful but assertive, citing documented evidence";
  else if (scenario === "lowball_counter") tone = "firm, justifying the full amount with facts";
  else if (days >= 14) tone = "escalating, noting the extended delay";

  const target = amount;
  const recommendedAction =
    offer > 0
      ? `Counter at $${target.toLocaleString()} (broker offered $${offer.toLocaleString()})`
      : `Hold firm at $${amount.toLocaleString()}`;

  return { scenario, score, days, target, minAcceptable, leverage, tone, recommendedAction, offer };
}

// Build the AI prompt for the negotiation reply email.
export function buildNegotiationPrompt(claim, load, carrier, strategy) {
  const cp = carrier || {};
  const scenarioLabel = SCENARIO_LABELS[strategy.scenario];
  const brokerResp = claim.broker_response
    ? `\nBroker's response:\n"${claim.broker_response}"\n`
    : "\n(Broker has not responded in writing.)\n";

  let bodyInstruction;
  if (strategy.scenario === "partial_counter" || strategy.scenario === "lowball_counter") {
    bodyInstruction = `Counters the broker's offer of $${strategy.offer.toLocaleString()}, requesting the full $${strategy.target.toLocaleString()} (or as close as possible), justifying with the documented detention facts. Do not accept below $${strategy.minAcceptable.toLocaleString()}.`;
  } else if (strategy.scenario === "denial_appeal") {
    bodyInstruction = `Appeals the denial by presenting the documented evidence (timestamps, billable hours, contract terms) and requesting reconsideration of the full $${strategy.target.toLocaleString()}.`;
  } else if (strategy.scenario === "documentation") {
    bodyInstruction = `Confirms the requested documentation is available and offers to provide the specific records, while holding firm on the full claim amount.`;
  } else {
    bodyInstruction = `Politely escalates, noting the time elapsed (${strategy.days} days) and requesting prompt resolution of the full $${strategy.target.toLocaleString()}.`;
  }

  return `You are a professional freight carrier negotiating a detention time claim with a broker. The broker has responded to the initial claim and you must craft the optimal reply.

Carrier: ${cp.company_name || "[Carrier]"} (MC#${cp.mc_number || "N/A"}, DOT#${cp.dot_number || "N/A"})
Broker: ${claim.broker_name || load?.broker_name || "[Broker]"}
Load #: ${claim.load_number || load?.load_number || "N/A"}

Detention facts:
- Total wait: ${Number(load?.total_wait_hours || 0).toFixed(2)} hrs
- Free detention: ${load?.free_detention_hours || 0} hrs
- Billable hours: ${Number(load?.billable_hours || 0).toFixed(2)} hrs
- Rate: $${load?.detention_rate_per_hour || 0}/hr
- Original claim amount: $${Number(claim.claim_amount || 0).toFixed(2)}
${claim.broker_offer_amount ? `- Broker's counter-offer: $${Number(claim.broker_offer_amount).toFixed(2)}\n` : ""}${brokerResp}
Negotiation strategy (internal guidance — do not state this verbatim):
- Scenario: ${scenarioLabel}
- Target amount: $${strategy.target.toLocaleString()} (do not accept below $${strategy.minAcceptable.toLocaleString()})
- Tone: ${strategy.tone}
- Leverage: ${strategy.leverage.join("; ") || "documented detention time"}

Write a professional negotiation reply email that:
1. Has a clear subject line referencing the load number and "Detention Claim".
2. Opens professionally, acknowledging the broker's position.
3. Politely but firmly restates the documented detention facts and billable hours.
4. ${bodyInstruction}
5. Closes requesting confirmation or payment, signed with the carrier company name.

Return JSON with "subject" and "body" fields. Body should be plain text with line breaks.`;
}