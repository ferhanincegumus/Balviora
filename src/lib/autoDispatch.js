// Auto-dispatch eligibility for ready-to-send claims.
import { computeScore } from "./claimScore";

export const AUTO_DISPATCH_MIN_SCORE = 85; // 8.5/10
export const AUTO_DISPATCH_MAX_AGE_DAYS = 60;

export function claimAgeDays(claim) {
  if (!claim) return Infinity;
  const created = claim.created_date ? new Date(claim.created_date) : null;
  if (!created || isNaN(created.getTime())) return Infinity;
  return (Date.now() - created.getTime()) / 86400000;
}

// evidenceCounts: { bol, pod, email_thread, other }
export function isEvidenceComplete(evidenceCounts = {}) {
  return (evidenceCounts.bol || 0) > 0 && (evidenceCounts.pod || 0) > 0;
}

// Returns { eligible, score, ageDays, reasons, missing }
export function evaluateAutoDispatch(claim, load, evidenceCounts = {}) {
  const reasons = [];
  const missing = [];

  const score = computeScore(claim, load);
  if (score < AUTO_DISPATCH_MIN_SCORE) reasons.push(`Score ${score} below ${AUTO_DISPATCH_MIN_SCORE}`);

  const age = claimAgeDays(claim);
  if (age > AUTO_DISPATCH_MAX_AGE_DAYS) reasons.push(`Age ${Math.round(age)}d over ${AUTO_DISPATCH_MAX_AGE_DAYS}d limit`);

  if (!claim?.email_body) {
    reasons.push("No claim email generated");
    missing.push("email");
  }

  if (!isEvidenceComplete(evidenceCounts)) {
    reasons.push("Missing BOL or POD evidence");
    if (!(evidenceCounts.bol > 0)) missing.push("bol");
    if (!(evidenceCounts.pod > 0)) missing.push("pod");
  }

  const eligible =
    reasons.length === 0 && claim?.status === "ready_to_send";

  return { eligible, score, ageDays: age, reasons, missing };
}