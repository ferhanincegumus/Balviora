// Deterministic success-probability score for a detention claim.
// Uses load metrics when available (ClaimDetail); falls back to claim-level data
// (Claims list, Dashboard) as a reasonable proxy.

const STATUS_BONUS = {
  paid: 20,
  approved: 15,
  partially_approved: 12,
  ready_to_send: 6,
  sent: 8,
  awaiting_response: 5,
  followup_required: 3,
  draft: 0,
  closed: 0,
  denied: -45,
  // legacy
  generated: 4,
  rejected: -45,
};

export function computeScore(claim, load) {
  if (!claim) return 0;

  const billable = load ? Number(load.billable_hours || 0) : 0;
  const amount = Number(claim.claim_amount || 0);

  let score = 40; // base

  // Stronger claims have clear, documented detention breaches.
  if (billable > 0) score += Math.min(billable * 6, 30); // up to +30

  // Larger amounts tend to get broker attention / documentation effort.
  if (amount > 0) score += Math.min(amount / 100, 15); // up to +15

  // Appointment on file => stronger documentation.
  if (load && load.appointment_time) score += 5;

  // Status reflects where the claim stands in the recovery lifecycle.
  score += STATUS_BONUS[claim.status] || 0;

  return Math.max(5, Math.min(95, Math.round(score)));
}

export function scoreTier(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}