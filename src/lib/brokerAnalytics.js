import { differenceInCalendarDays } from "date-fns";

const TERMINAL = ["approved", "partially_approved", "denied", "paid", "closed"];

// Behavior classification badges + styles (also used by the page).
export const BEHAVIOR_META = {
  fast_payer: { label: "Fast Payer", className: "bg-emerald-500/15 text-emerald-400" },
  reliable: { label: "Reliable", className: "bg-blue-500/15 text-blue-400" },
  negotiator: { label: "Negotiator", className: "bg-amber-500/15 text-amber-400" },
  slow_payer: { label: "Slow Payer", className: "bg-orange-500/15 text-orange-400" },
  denier: { label: "Frequent Denier", className: "bg-red-500/15 text-red-400" },
  at_risk: { label: "At Risk", className: "bg-rose-500/15 text-rose-400" },
  standard: { label: "Standard", className: "bg-muted text-muted-foreground" },
};

// Classify a single broker from its aggregate metrics.
export function classifyBehavior(metrics) {
  const deniedRatio = metrics.claimCount ? (metrics.statusCounts.denied || 0) / metrics.claimCount : 0;
  const partialRatio = metrics.claimCount ? ((metrics.statusCounts.partially_approved || 0) + (metrics.brokerOfferCount || 0)) / metrics.claimCount : 0;
  const recoveryRate = metrics.totalClaimed > 0 ? metrics.recoveredAmount / metrics.totalClaimed : 0;

  if (deniedRatio >= 0.4) return "denier";
  if (metrics.avgDaysToResolution > 14) return "slow_payer";
  if (partialRatio >= 0.3) return "negotiator";
  if (recoveryRate >= 0.8 && metrics.avgDaysToResolution <= 7) return "fast_payer";
  if (recoveryRate >= 0.6) return "reliable";
  if (recoveryRate < 0.4 && metrics.claimCount >= 2) return "at_risk";
  return "standard";
}

// Aggregate per-broker metrics from all claims.
export function computeBrokerMetrics(claims) {
  if (!claims || claims.length === 0) return [];

  const byBroker = {};
  claims.forEach((c) => {
    const name = (c.broker_name || "Unknown Broker").trim() || "Unknown Broker";
    if (!byBroker[name]) {
      byBroker[name] = {
        broker_name: name,
        claims: [],
        totalClaimed: 0,
        recoveredAmount: 0,
        resolvedCount: 0,
        resolvedDays: [],
        statusCounts: {},
        brokerOfferCount: 0,
      };
    }
    const b = byBroker[name];
    b.claims.push(c);
    b.totalClaimed += Number(c.claim_amount || 0);
    const recovered = Number(c.paid_amount || 0) || Number(c.approved_amount || 0);
    if (recovered > 0) b.recoveredAmount += recovered;
    b.statusCounts[c.status] = (b.statusCounts[c.status] || 0) + 1;
    if (c.broker_offer_amount && Number(c.broker_offer_amount) > 0) b.brokerOfferCount += 1;

    if (TERMINAL.includes(c.status) && c.sent_date) {
      const end = c.response_date || c.updated_date || c.last_followup_date;
      if (end) {
        const days = differenceInCalendarDays(new Date(end), new Date(c.sent_date));
        if (days >= 0) b.resolvedDays.push(days);
      }
    }
  });

  return Object.values(byBroker)
    .map((b) => {
      const claimCount = b.claims.length;
      const avgDaysToResolution = b.resolvedDays.length > 0
        ? Math.round(b.resolvedDays.reduce((s, d) => s + d, 0) / b.resolvedDays.length)
        : null;
      const recoveryRate = b.totalClaimed > 0 ? b.recoveredAmount / b.totalClaimed : 0;
      const metrics = {
        broker_name: b.broker_name,
        claims: b.claims,
        claimCount,
        totalClaimed: b.totalClaimed,
        recoveredAmount: b.recoveredAmount,
        recoveryRate,
        approvalRate: claimCount ? ((b.statusCounts.approved || 0) + (b.statusCounts.partially_approved || 0) + (b.statusCounts.paid || 0)) / claimCount : 0,
        avgDaysToResolution,
        resolvedCount: b.resolvedDays.length,
        statusCounts: b.statusCounts,
        brokerOfferCount: b.brokerOfferCount,
        outstanding: b.totalClaimed - b.recoveredAmount,
      };
      metrics.behavior = classifyBehavior(metrics);
      return metrics;
    })
    .sort((a, b) => b.totalClaimed - a.totalClaimed);
}

// Overall roll-up across all brokers (for summary cards).
export function computeOverallMetrics(brokerMetrics) {
  if (!brokerMetrics || brokerMetrics.length === 0) {
    return { brokerCount: 0, totalClaimed: 0, recoveredAmount: 0, recoveryRate: 0, behaviorCounts: {}, topBroker: null };
  }
  const totalClaimed = brokerMetrics.reduce((s, b) => s + b.totalClaimed, 0);
  const recoveredAmount = brokerMetrics.reduce((s, b) => s + b.recoveredAmount, 0);
  const behaviorCounts = {};
  brokerMetrics.forEach((b) => {
    behaviorCounts[b.behavior] = (behaviorCounts[b.behavior] || 0) + 1;
  });
  const topBroker = [...brokerMetrics].sort((a, b) => b.recoveredAmount - a.recoveredAmount)[0];
  return {
    brokerCount: brokerMetrics.length,
    totalClaimed,
    recoveredAmount,
    recoveryRate: totalClaimed > 0 ? recoveredAmount / totalClaimed : 0,
    behaviorCounts,
    topBroker,
  };
}

// A–F letter grade from aggregate broker performance (recovery rate,
// approval rate, days-to-pay). Shown grade-first on the dispatcher leaderboard.
export function brokerGrade(metrics) {
  const sc = metrics?.statusCounts || {};
  const closedCount =
    (sc.approved || 0) + (sc.partially_approved || 0) +
    (sc.denied || 0) + (sc.paid || 0) + (sc.closed || 0);
  if (!metrics || !metrics.claimCount || closedCount < 3) {
    return { letter: null, score: null, color: "text-muted-foreground", insufficient: true };
  }
  const recoveryRate = metrics.recoveryRate || 0;
  const days = metrics.avgDaysToResolution;
  const approvedCount =
    (metrics.statusCounts.approved || 0) +
    (metrics.statusCounts.partially_approved || 0) +
    (metrics.statusCounts.paid || 0);
  const approvalRate = metrics.claimCount ? approvedCount / metrics.claimCount : 0;
  let score = recoveryRate * 50 + approvalRate * 25;
  score += days != null ? (Math.max(0, 30 - days) / 30) * 25 : 12;
  score = Math.round(score);
  let letter = "F";
  if (score >= 85) letter = "A";
  else if (score >= 70) letter = "B";
  else if (score >= 55) letter = "C";
  else if (score >= 40) letter = "D";
  const color =
    letter === "A" || letter === "B" ? "text-money" : letter === "C" ? "text-alert" : "text-risk";
  return { letter, score, color };
}