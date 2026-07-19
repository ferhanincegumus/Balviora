import { base44 } from "@/api/base44Client";
import { computeScore } from "@/lib/claimScore";
import { getDaysWaiting, getFollowUpUrgency } from "@/lib/followUpEngine";

const TERMINAL = ["approved", "partially_approved", "denied", "paid", "closed"];

// Evidence strength 0-100 based on load documentation completeness.
export function evidenceStrength(load) {
  if (!load) return 20;
  let s = 0;
  if (load.arrival_time) s += 25;
  if (load.departure_time) s += 25;
  if (load.appointment_time) s += 20;
  if (load.pickup_location && load.delivery_location) s += 15;
  if (Number(load.billable_hours || 0) > 0) s += 15;
  return Math.min(100, s);
}

// Composite priority score for ranking open claims needing action.
// Weights: days waiting (urgency) 35%, recovery probability 30%, amount 20%, evidence 15%.
export function priorityScore(claim, load) {
  const score = computeScore(claim, load);
  const days = getDaysWaiting(claim);
  const amount = Number(claim.claim_amount || 0);
  const evidence = evidenceStrength(load);

  const daysFactor = Math.min(days / 14, 1) * 100;
  const amountFactor = Math.min(amount / 500, 1) * 100;

  return Math.round(
    daysFactor * 0.35 +
    score * 0.30 +
    amountFactor * 0.20 +
    evidence * 0.15
  );
}

// Returns open claims sorted by priority, each enriched with days/score/urgency/evidence.
export function prioritizeClaims(claims, loads) {
  if (!claims) return [];
  return claims
    .filter((c) => !TERMINAL.includes(c.status))
    .map((c) => {
      const load = (loads || []).find((l) => l.id === c.load_id);
      const days = getDaysWaiting(c);
      const urgency = getFollowUpUrgency(c);
      const score = computeScore(c, load);
      const priority = priorityScore(c, load);
      return { claim: c, load, days, urgency, score, priority, evidence: evidenceStrength(load) };
    })
    .sort((a, b) => b.priority - a.priority);
}

// Categorize prioritized claims into the three dashboard sections.
export function categorizeRecovery(prioritized) {
  const urgent = prioritized.filter(
    (p) => p.urgency.due && (p.urgency.urgency === "high" || p.urgency.urgency === "critical")
  );
  const recommended = prioritized.filter((p) => p.urgency.due);
  const opportunities = prioritized.filter(
    (p) => ["draft", "ready_to_send"].includes(p.claim.status) && p.score >= 40
  );
  return { urgent, recommended, opportunities };
}

// Expected recovery = claim amount weighted by recovery probability.
export function expectedRecovery(claim, score) {
  const amt = Number(claim.claim_amount || 0);
  return Math.round(amt * (score / 100));
}

// Human-readable reason for why a claim is prioritized.
export function reasonFor(p) {
  const { claim, days, score, urgency } = p;
  if (["draft", "ready_to_send"].includes(claim.status)) {
    return `High recovery probability (${score}%) — claim not yet sent to broker.`;
  }
  return `No broker response for ${days} day${days === 1 ? "" : "s"}. ${urgency.action}. Recovery probability ${score}%.`;
}

// Builds the AI prompt for the daily recovery summary.
export function buildDailySummaryPrompt(prioritized) {
  const active = prioritized.length;
  const potential = prioritized.reduce((s, p) => s + (p.claim.claim_amount || 0), 0);
  const top = prioritized[0];

  const topInfo = top
    ? `Top priority claim: Load #${top.claim.load_number || "?"}, amount $${(top.claim.claim_amount || 0).toLocaleString()}, broker ${top.claim.broker_name || "?"}, waiting ${top.days} days, recovery probability ${top.score}%. Problem: ${top.urgency.action.toLowerCase()}.`
    : "No open claims right now.";

  return `You are the Detention Shield AI Revenue Recovery Agent for a trucking carrier. Generate a concise, friendly "Today's Recovery Summary" message. Start with a time-of-day greeting. Be encouraging but action-oriented. Keep it under 90 words. Plain text only, no markdown or bullet points.

Current state:
- Active detention claims: ${active}
- Potential recovery (open claim value): $${potential.toLocaleString()}
- ${topInfo}

Write the summary.`;
}

export async function generateDailySummary(prioritized) {
  const prompt = buildDailySummaryPrompt(prioritized);
  const res = await base44.integrations.Core.InvokeLLM({ prompt });
  return typeof res === "string" ? res.trim() : String(res || "");
}