// Shared detention rate resolution. Broker-facing calculations ALWAYS use
// contractRate (what the broker owes, from the rate con). payoutRate is the
// internal driver pay. Precedence: per-load override -> per-driver override
// -> company default -> safe fallback.

export const SAFE_DEFAULTS = {
  freeHours: 2,
  contractRate: 50,
  payoutRate: 25,
};

function num(v, fallback) {
  if (v == null || v === "" || isNaN(Number(v))) return fallback;
  return Number(v);
}

// Resolve effective rates for a load. Pass the load record, its driver record
// (optional), and the company record (optional).
// Returns { freeHours, contractRate, payoutRate }.
export function resolveRates(load = {}, driver = null, company = null) {
  const freeHours = num(
    load.free_detention_hours,
    num(driver?.free_detention_hours, num(company?.default_free_hours, SAFE_DEFAULTS.freeHours))
  );
  // Broker-facing: prefer explicit contract_rate, fall back to legacy
  // detention_rate_per_hour, then company default.
  const contractRate = num(
    load.contract_rate ?? load.detention_rate_per_hour,
    num(company?.default_rate_per_hour, SAFE_DEFAULTS.contractRate)
  );
  // Internal driver payout: load -> driver -> company default.
  const payoutRate = num(
    load.payout_rate_per_hour,
    num(driver?.payout_rate_per_hour, num(company?.default_payout_rate_per_hour, SAFE_DEFAULTS.payoutRate))
  );
  return { freeHours, contractRate, payoutRate };
}

// Billable detention hours given arrival/departure timestamps and free hours.
export function billableHours(arrival, departure, freeHours) {
  if (!arrival || !departure) return 0;
  const start = new Date(arrival).getTime();
  const end = new Date(departure).getTime();
  if (!start || !end || end <= start) return 0;
  const hours = (end - start) / 3600000;
  return Math.max(0, Number((hours - freeHours).toFixed(2)));
}

// Broker-facing claim amount = billable hours x contract rate.
export function claimAmount(arrival, departure, rates) {
  const bh = billableHours(arrival, departure, rates.freeHours);
  return Math.round(bh * rates.contractRate);
}

// Internal driver payout for the same wait = billable hours x payout rate.
export function payoutFor(arrival, departure, rates) {
  const bh = billableHours(arrival, departure, rates.freeHours);
  return Math.round(bh * rates.payoutRate);
}