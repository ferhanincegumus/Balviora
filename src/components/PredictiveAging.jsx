import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { computeScore } from "@/lib/claimScore";
import { predictAging } from "@/lib/predictiveAging";
import { AlertOctagon, Clock, Flame, ArrowUpRight } from "lucide-react";

const RISK_META = {
  critical: { label: "Critical risk", className: "bg-red-500/15 text-red-400 border-red-500/30", icon: Flame },
  high: { label: "High risk", className: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertOctagon },
  medium: { label: "Medium risk", className: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
  low: { label: "Low risk", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Clock },
};

export default function PredictiveAging({ claims = [], loads = [], evidenceMap = {} }) {
  const open = claims.filter((c) =>
    !["approved", "partially_approved", "denied", "paid", "closed"].includes(c.status)
  );

  const predictions = open
    .map((c) => {
      const load = loads.find((l) => l.id === c.load_id);
      const ev = evidenceMap[c.id] || {};
      const evidenceComplete = (ev.bol || 0) > 0 && (ev.pod || 0) > 0;
      const pred = predictAging(c, claims, evidenceComplete);
      return { claim: c, load, pred, score: computeScore(c, load) };
    })
    .filter((p) => p.pred && !p.pred.terminal);

  const sorted = [...predictions].sort((a, b) => (b.pred.denialProbability || 0) - (a.pred.denialProbability || 0));
  const top = sorted.slice(0, 5);

  if (top.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold">Predictive Aging</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        AI denial-risk forecast per open claim — based on broker history, age, evidence, and amount. High-risk claims may need auto-escalation.
      </p>

      <div className="space-y-2">
        {top.map(({ claim, pred, score }) => {
          const meta = RISK_META[pred.riskLevel] || RISK_META.low;
          const Icon = meta.icon;
          return (
            <Link
              key={claim.id}
              to={`/claims/${claim.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
            >
              <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border ${meta.className}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{claim.load_number || "—"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${meta.className}`}>{meta.label}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {claim.broker_name || "—"} · ${((claim.claim_amount || 0)).toLocaleString()} · {pred.daysWaiting}d waiting
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Denial risk</p>
                <p className={`text-lg font-bold ${pred.denialProbability >= 70 ? "text-red-400" : pred.denialProbability >= 50 ? "text-orange-400" : "text-amber-400"}`}>
                  {pred.denialProbability}%
                </p>
              </div>
              {pred.autoEscalate && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium text-red-400 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30">
                  <ArrowUpRight className="w-3 h-3" /> Escalate
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Predicted resolution for riskiest claim: <span className="text-foreground font-medium">{top[0].pred.predictedResolutionDays} days</span>. Forecast uses broker denial history, claim age, evidence completeness, and amount.
      </p>
    </Card>
  );
}