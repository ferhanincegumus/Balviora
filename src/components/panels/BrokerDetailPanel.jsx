import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { computeScore } from "@/lib/claimScore";
import { computeBrokerMetrics, BEHAVIOR_META } from "@/lib/brokerAnalytics";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import { Building2, TrendingUp, Award, Clock, ChevronRight, AlertTriangle } from "lucide-react";

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const fmtPct = (n) => `${Math.round((n || 0) * 100)}%`;

export default function BrokerDetailPanel({ brokerName, onClose }) {
  const { openPanel } = useSidePanel();
  const [broker, setBroker] = useState(null);
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    if (!brokerName) return;
    setBroker(null);
    base44.entities.Claim.list("-updated_date", 500)
      .then((all) => {
        const name = brokerName.trim() || "Unknown Broker";
        const filtered = all.filter((c) => (c.broker_name || "").trim() === name);
        setClaims(filtered);
        const metrics = computeBrokerMetrics(all).find((m) => m.broker_name === name);
        setBroker(metrics || {
          broker_name: name,
          claims: filtered,
          claimCount: filtered.length,
          totalClaimed: filtered.reduce((s, c) => s + Number(c.claim_amount || 0), 0),
          recoveredAmount: 0,
          recoveryRate: 0,
          avgDaysToResolution: null,
          statusCounts: {},
          behavior: "standard",
          outstanding: 0,
        });
      })
      .catch(() => setBroker(false));
  }, [brokerName]);

  if (broker === null) return <div className="p-10 text-center text-muted-foreground">Loading broker…</div>;
  if (broker === false) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Broker not found.</p>
        <Card className="p-3 mt-4 text-sm text-muted-foreground bg-muted/30">{brokerName}</Card>
      </div>
    );
  }

  const meta = BEHAVIOR_META[broker.behavior] || BEHAVIOR_META.standard;
  const sortedClaims = [...claims].sort((a, b) => (b.claim_amount || 0) - (a.claim_amount || 0));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{broker.broker_name}</h2>
              <span className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
                {broker.behavior === "at_risk" && <AlertTriangle className="w-3 h-3 mr-1" />}
                {meta.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><TrendingUp className="w-3 h-3" /> Claimed</div>
            <p className="text-lg font-bold mt-1">{fmtMoney(broker.totalClaimed)}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Award className="w-3 h-3" /> Recovered</div>
            <p className="text-lg font-bold mt-1 text-emerald-400">{fmtMoney(broker.recoveredAmount)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recovery Rate</div>
            <p className={`text-lg font-bold mt-1 ${broker.recoveryRate >= 0.6 ? "text-emerald-400" : broker.recoveryRate < 0.4 ? "text-red-400" : ""}`}>{fmtPct(broker.recoveryRate)}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Clock className="w-3 h-3" /> Avg Days</div>
            <p className="text-lg font-bold mt-1">{broker.avgDaysToResolution != null ? `${broker.avgDaysToResolution}d` : "—"}</p>
          </Card>
        </div>

        {broker.outstanding > 0 && (
          <Card className="p-3 border-l-4 border-l-amber-500">
            <p className="text-sm"><span className="text-muted-foreground">Outstanding:</span> <span className="font-bold text-amber-400">{fmtMoney(broker.outstanding)}</span></p>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claims</p>
            <span className="text-xs text-muted-foreground">{broker.claimCount}</span>
          </div>
          {sortedClaims.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No claims for this broker.</Card>
          ) : (
            <div className="space-y-2">
              {sortedClaims.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openPanel("claim", { id: c.id }, { title: `Claim ${c.load_number || ""}` })}
                  className="w-full text-left"
                >
                  <Card className="p-3 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.load_number || "—"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={c.status} />
                          <ScoreBadge score={computeScore(c)} label={false} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-primary">${(c.claim_amount || 0).toLocaleString()}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}