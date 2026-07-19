// Shared detention loss calculation model used by both the landing teaser
// calculator and the full dashboard calculator.

export const SHIPPER_TYPES = [
  { id: "big_box", label: "Big-box retail DC", waitMultiplier: 1.4, baseRecovery: 0.55 },
  { id: "grocery", label: "Grocery DC", waitMultiplier: 1.25, baseRecovery: 0.5 },
  { id: "manufacturing", label: "Manufacturing / plant", waitMultiplier: 0.9, baseRecovery: 0.6 },
  { id: "intermodal", label: "Intermodal / rail ramp", waitMultiplier: 1.3, baseRecovery: 0.5 },
  { id: "distribution", label: "Distribution center", waitMultiplier: 1.15, baseRecovery: 0.48 },
  { id: "general", label: "General freight", waitMultiplier: 1.0, baseRecovery: 0.45 },
];

export const REGIONS = [
  { id: "national", label: "National average", multiplier: 1.0 },
  { id: "northeast", label: "Northeast", multiplier: 1.15 },
  { id: "midwest", label: "Midwest", multiplier: 0.95 },
  { id: "south", label: "South", multiplier: 0.9 },
  { id: "west", label: "West / California", multiplier: 1.1 },
  { id: "texas", label: "Texas / Southwest", multiplier: 1.05 },
];

export const RECOVERY_SCENARIOS = [
  { id: "conservative", label: "Conservative", recoveryRate: 0.4, note: "Manual claim filing, no follow-up automation" },
  { id: "moderate", label: "Moderate (with Detention Recover AI)", recoveryRate: 0.6, note: "AI demand emails + automated follow-ups" },
  { id: "aggressive", label: "Aggressive (full platform)", recoveryRate: 0.78, note: "AI negotiation loop + broker intelligence" },
];

export const CURRENT_RECOVERY_BENCHMARK = 0.2; // typical carrier recovers ~20% of valid detention

export function calculateDetentionLoss({
  fleetSize = 1,
  loadsPerWeekPerTruck = 3,
  avgWaitHours = 3.5,
  detentionRatePerHour = 50,
  shipperType = "general",
  region = "national",
  scenarioRecoveryRate = 0.6,
  currentRecoveryRate = CURRENT_RECOVERY_BENCHMARK,
}) {
  const shipper = SHIPPER_TYPES.find((s) => s.id === shipperType) || SHIPPER_TYPES[5];
  const reg = REGIONS.find((r) => r.id === region) || REGIONS[0];

  const adjustedWait = Math.max(0, avgWaitHours * shipper.waitMultiplier * reg.multiplier);
  const loadsPerYear = Math.max(0, Math.round(fleetSize * loadsPerWeekPerTruck * 50));
  const annualPotential = loadsPerYear * adjustedWait * detentionRatePerHour;
  const currentlyRecovered = annualPotential * currentRecoveryRate;
  const annualLoss = Math.max(0, annualPotential - currentlyRecovered);
  const withScenario = annualPotential * scenarioRecoveryRate;
  const uplift = Math.max(0, withScenario - currentlyRecovered);
  const roiMultiple = currentlyRecovered > 0 ? withScenario / currentlyRecovered : 0;

  return {
    fleetSize,
    loadsPerYear,
    adjustedWaitHours: Number(adjustedWait.toFixed(1)),
    annualPotential: Math.round(annualPotential),
    currentlyRecovered: Math.round(currentlyRecovered),
    annualLoss: Math.round(annualLoss),
    withScenario: Math.round(withScenario),
    uplift: Math.round(uplift),
    roiMultiple: Number(roiMultiple.toFixed(1)),
  };
}

export function formatCurrency(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
}