import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Truck,
  MapPin,
  Layers,
  FileDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calculator,
} from "lucide-react";
import {
  SHIPPER_TYPES,
  REGIONS,
  RECOVERY_SCENARIOS,
  calculateDetentionLoss,
  formatCurrency,
} from "@/lib/detentionCalc";

export default function DetentionCalculator() {
  const [fleetSize, setFleetSize] = useState("3");
  const [loadsPerWeek, setLoadsPerWeek] = useState("3");
  const [avgWaitHours, setAvgWaitHours] = useState("3.5");
  const [detentionRate, setDetentionRate] = useState("50");
  const [shipperType, setShipperType] = useState("general");
  const [region, setRegion] = useState("national");
  const [scenario, setScenario] = useState("moderate");

  const scenarioRate = RECOVERY_SCENARIOS.find((s) => s.id === scenario)?.recoveryRate ?? 0.6;

  const result = useMemo(
    () =>
      calculateDetentionLoss({
        fleetSize: Number(fleetSize) || 0,
        loadsPerWeekPerTruck: Number(loadsPerWeek) || 0,
        avgWaitHours: Number(avgWaitHours) || 0,
        detentionRatePerHour: Number(detentionRate) || 0,
        shipperType,
        region,
        scenarioRecoveryRate: scenarioRate,
      }),
    [fleetSize, loadsPerWeek, avgWaitHours, detentionRate, shipperType, region, scenarioRate]
  );

  const handleExport = () => {
    const lines = [
      "Detention Loss Recovery Report",
      "Detention Recover AI",
      "================================",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Fleet Inputs",
      `  Trucks in fleet: ${fleetSize}`,
      `  Loads per truck / week: ${loadsPerWeek}`,
      `  Loads per year: ${result.loadsPerYear.toLocaleString()}`,
      `  Avg detention hours / load: ${avgWaitHours}`,
      `  Adjusted wait hours (shipper + region): ${result.adjustedWaitHours}`,
      `  Detention rate / hour: ${formatCurrency(Number(detentionRate) || 0)}`,
      "",
      "Shipper & Region",
      `  Shipper type: ${SHIPPER_TYPES.find((s) => s.id === shipperType)?.label}`,
      `  Region: ${REGIONS.find((r) => r.id === region)?.label}`,
      "",
      "Recovery Scenario",
      `  Selected: ${RECOVERY_SCENARIOS.find((s) => s.id === scenario)?.label}`,
      `  Scenario recovery rate: ${Math.round(scenarioRate * 100)}%`,
      "",
      "Results",
      `  Total annual detention exposure: ${formatCurrency(result.annualPotential)}`,
      `  Currently recovered (~20%): ${formatCurrency(result.currentlyRecovered)}`,
      `  Estimated annual loss: ${formatCurrency(result.annualLoss)}`,
      `  With selected scenario: ${formatCurrency(result.withScenario)}`,
      `  Additional recovery (uplift): ${formatCurrency(result.uplift)}`,
      `  Recovery multiple: ${result.roiMultiple}x`,
      "",
      "Start recovering today at Detention Recover AI.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "detention-recovery-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Detention Loss Calculator</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileDown className="w-4 h-4 mr-1.5" /> Export report
        </Button>
      </div>

      {/* Live summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-400 uppercase tracking-wider">Annual loss</p>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(result.annualLoss)}</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-400 uppercase tracking-wider">Total exposure</p>
          <p className="text-xl font-bold text-blue-400">{formatCurrency(result.annualPotential)}</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-emerald-400 uppercase tracking-wider">Recoverable uplift</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(result.uplift)}</p>
        </div>
        <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <p className="text-xs text-violet-400 uppercase tracking-wider">Recovery multiple</p>
          <p className="text-xl font-bold text-violet-400">{result.roiMultiple}x</p>
        </div>
      </div>

      <Tabs defaultValue="fleet">
        {/* Fleet */}
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="fleet"><Truck className="w-3.5 h-3.5 mr-1.5" />Fleet</TabsTrigger>
          <TabsTrigger value="shipper"><Layers className="w-3.5 h-3.5 mr-1.5" />Shipper</TabsTrigger>
          <TabsTrigger value="scenarios"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Scenarios</TabsTrigger>
          <TabsTrigger value="report"><FileDown className="w-3.5 h-3.5 mr-1.5" />Report</TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Trucks in fleet">
            <Input type="number" min="1" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} />
          </Field>
          <Field label="Loads per truck / week">
            <Input type="number" min="1" value={loadsPerWeek} onChange={(e) => setLoadsPerWeek(e.target.value)} />
          </Field>
          <Field label="Avg detention hours / load">
            <Input type="number" min="0" step="0.5" value={avgWaitHours} onChange={(e) => setAvgWaitHours(e.target.value)} />
          </Field>
          <Field label="Detention rate / hour ($)">
            <Input type="number" min="0" value={detentionRate} onChange={(e) => setDetentionRate(e.target.value)} />
          </Field>
          <div className="sm:col-span-2 text-sm text-muted-foreground">
            → {result.loadsPerYear.toLocaleString()} loads/year · {result.adjustedWaitHours}h adjusted wait
          </div>
        </TabsContent>

        {/* Shipper & Region */}
        <TabsContent value="shipper" className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Shipper / facility type">
            <SelectBox value={shipperType} onChange={setShipperType} options={SHIPPER_TYPES} />
          </Field>
          <Field label="Primary region">
            <SelectBox value={region} onChange={setRegion} options={REGIONS} />
          </Field>
          <div className="sm:col-span-2 p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Shipper and region adjust average wait time. Big-box DCs and Northeast loads tend to run longest.
          </div>
        </TabsContent>

        {/* Scenarios */}
        <TabsContent value="scenarios" className="mt-5 space-y-3">
          {RECOVERY_SCENARIOS.map((s) => {
            const active = s.id === scenario;
            const res = calculateDetentionLoss({
              fleetSize: Number(fleetSize) || 0,
              loadsPerWeekPerTruck: Number(loadsPerWeek) || 0,
              avgWaitHours: Number(avgWaitHours) || 0,
              detentionRatePerHour: Number(detentionRate) || 0,
              shipperType,
              region,
              scenarioRecoveryRate: s.recoveryRate,
            });
            return (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(res.withScenario)}</p>
                    <p className="text-xs text-muted-foreground">{Math.round(s.recoveryRate * 100)}% recovery</p>
                  </div>
                </div>
                {active && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm">
                    <TrendingDown className="w-4 h-4 text-amber-400" />
                    <span className="text-muted-foreground">Extra vs. today: </span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(res.uplift)}</span>
                  </div>
                )}
              </button>
            );
          })}
        </TabsContent>

        {/* Report */}
        <TabsContent value="report" className="mt-5">
          <div className="p-5 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="font-medium">Recovery summary</p>
            </div>
            <ul className="space-y-2 text-sm">
              <SummaryRow label="Total annual detention exposure" value={formatCurrency(result.annualPotential)} />
              <SummaryRow label="Currently recovered (~20%)" value={formatCurrency(result.currentlyRecovered)} />
              <SummaryRow label="Estimated annual loss" value={formatCurrency(result.annualLoss)} accent="text-amber-400" />
              <SummaryRow label={`With ${RECOVERY_SCENARIOS.find((s) => s.id === scenario)?.label}`} value={formatCurrency(result.withScenario)} accent="text-emerald-400" />
              <SummaryRow label="Additional recoverable" value={formatCurrency(result.uplift)} accent="text-emerald-400" />
              <SummaryRow label="Recovery multiple" value={`${result.roiMultiple}x`} />
            </ul>
            <Button onClick={handleExport} className="mt-4">
              <FileDown className="w-4 h-4 mr-1.5" /> Export full report
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SelectBox({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id} className="bg-card">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SummaryRow({ label, value, accent }) {
  return (
    <li className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent || ""}`}>{value}</span>
    </li>
  );
}