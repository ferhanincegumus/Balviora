// Predictive aging: estimate denial probability, predicted resolution time,
// and auto-escalation recommendation for an open claim.
import { differenceInCalendarDays } from "date-fns";
import { computeBrokerMetrics } from "@/lib/brokerAnalytics";

const TERMINAL = ["approved", "partially_approved", "denied", "paid", "closed"];

// Returns { denialProbability, predictedResolutionDays, riskLevel, autoEscalate, factors }
// claim: the open claim. allClaims: all claims (for broker history). evidenceComplete: bool.
export function predictAging(claim, allClaims = [], evidenceComplete = false) {
  if (!claim) return null;
  if (TERMINAL.includes(claim.status)) {
    return { terminal: true, denialProbability: claim.status === "denied" ? 100 : 0 };
  }

  const now = new Date();
  const sentDate = claim.sent_date ? new Date(claim.sent_date) : claim.created_date ? new Date(claim.created_date) : now;
  const daysWaiting = Math.max(0, differenceInCalendarDays(now, sentDate));
  const amount = Number(claim.claim_amount || 0);

  // --- Broker history factor ---
  const brokerMetrics = computeBrokerMetrics(allClaims);
  const broker = brokerMetrics.find(
    (b) => (b.broker_name || "").trim() === (claim.broker_name || "").trim()
  );
  const brokerDenialRate = broker && broker.claimCount > 0
    ? (broker.statusCounts.denied || 0) / broker.claimCount
    : 0.2; // default 20% if unknown
  const brokerAvgDays = broker && broker.avgDaysToResolution != null ? broker.avgDaysToResolution : 10;

  // --- Evidence factor ---
  const evidenceScore = evidenceComplete ? 1 : 0.4;

  // --- Denial probability model (logistic-style additive) ---
  let denial = 0;
  // Broker denial history (weight 35)
  denial += brokerDenialRate * 35;
  // Aging risk: past day 21 climbs fast (weight 30)
  if (daysWaiting > 21) denial += Math.min(30, (daysWaiting - 21) * 1.5);
  else denial += daysWaiting * 0.4;
  // Weak evidence increases denial (weight 20)
  denial += (1 - evidenceScore) * 20;
  // Larger claims slightly more contested (weight 15)
  denial += Math.min(15, amount / 200);
  // No response yet vs. active negotiation: unanswered claims drift toward denial
  if (claim.status === "sent" || claim.status === "awaiting_response") denial += 5;

  const denialProbability = Math.round(Math.max(5, Math.min(92, denial)));

  // --- Predicted resolution days ---
  let predictedResolutionDays = Math.round(brokerAvgDays);
  if (daysWaiting > brokerAvgDays) {
    predictedResolutionDays = daysWaiting + Math.max(3, Math.round((daysWaiting - brokerAvgDays) / 2));
  }
  if (denialProbability > 70) predictedResolutionDays = Math.max(predictedResolutionDays, daysWaiting + 7);

  // --- Risk level ---
  let riskLevel = "low";
  if (denialProbability >= 70 || daysWaiting >= 45) riskLevel = "critical";
  else if (denialProbability >= 50 || daysWaiting >= 30) riskLevel = "high";
  else if (denialProbability >= 35 || daysWaiting >= 14) riskLevel = "medium";

  // --- Auto-escalation recommendation ---
  const autoEscalate =
    (riskLevel === "critical" && daysWaiting >= 21) ||
    (denialProbability >= 65 && daysWaiting >= 14);

  const factors = [];
  factors.push({ label: "Broker denial history", value: `${Math.round(brokerDenialRate * 100)}%`, impact: brokerDenialRate > 0.4 ? "high" : brokerDenialRate > 0.25 ? "medium" : "low" });
  factors.push({ label: "Days waiting", value: `${daysWaiting}d`, impact: daysWaiting > 21 ? "high" : daysWaiting > 10 ? "medium" : "low" });
  factors.push({ label: "Evidence on file", value: evidenceComplete ? "Complete (BOL+POD)" : "Incomplete", impact: evidenceComplete ? "low" : "high" });
  factors.push({ label: "Claim amount", value: `$${amount.toLocaleString()}`, impact: amount > 500 ? "medium" : "low" });

  return {
    terminal: false,
    denialProbability,
    predictedResolutionDays,
    riskLevel,
    autoEscalate,
    daysWaiting,
    factors,
  };
}