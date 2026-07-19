import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import { computeBrokerMetrics, computeOverallMetrics, BEHAVIOR_META, brokerGrade } from "@/lib/brokerAnalytics";
import { cn } from "@/lib/utils";
import PortfolioNegotiation from "@/components/PortfolioNegotiation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Building2, TrendingUp, Award, Users, ArrowUpDown, Trophy, AlertTriangle } from "lucide-react";
import { useSidePanel } from "@/components/panels/SidePanelContext";

const BEHAVIOR_COLORS = {
  fast_payer: "hsl(160 60% 45%)",
  reliable: "hsl(217 91% 60%)",
  negotiator: "hsl(38 92% 55%)",
  slow_payer: "hsl(25 90% 55%)",
  denier: "hsl(0 72% 51%)",
  at_risk: "hsl(340 75% 55%)",
  standard: "hsl(217 20% 50%)",
};

const fmtMoney = (n) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n) => `${Math.round(n * 100)}%`;

export default function BrokerIntelligence() {
  const { openPanel } = useSidePanel();
  const [claims, setClaims] = useState(null);
  const [sortKey, setSortKey] = useState("gradeScore");
  const [sortDir, setSortDir] = useState("desc");

  const loadClaims = () => {
    base44.entities.Claim.list("-updated_date", 500)
      .then(setClaims)
      .catch(() => setClaims([]));
  };

  useEffect(() => {
    loadClaims();
  }, []);

  if (claims === null) {
    return <Card className="p-10 text-center text-muted-foreground">Loading broker intelligence…</Card>;
  }

  const brokerMetrics = computeBrokerMetrics(claims);
  const overall = computeOverallMetrics(brokerMetrics);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const rows = brokerMetrics.map((b) => {
    const grade = brokerGrade(b);
    return { ...b, grade, gradeScore: grade.score ?? -1 };
  });
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const behaviorData = Object.entries(overall.behaviorCounts).map(([key, value]) => ({
    name: BEHAVIOR_META[key].label,
    value,
    key,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Broker Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Recovery performance and payment behavior by broker.</p>
      </div>

      {brokerMetrics.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No broker data yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Create claims to start building broker intelligence.</p>
          <Link to="/claims"><Button className="mt-4" variant="outline">View claims</Button></Link>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Brokers Tracked" value={overall.brokerCount} icon={Users} />
            <StatCard label="Total Claimed" value={fmtMoney(overall.totalClaimed)} icon={TrendingUp} />
            <StatCard label="Recovered" value={fmtMoney(overall.recoveredAmount)} sublabel={`${fmtPct(overall.recoveryRate)} recovery rate`} icon={Award} accent="emerald" />
            <StatCard
              label="Top Broker"
              value={overall.topBroker?.broker_name || "—"}
              sublabel={overall.topBroker ? `${fmtMoney(overall.topBroker.recoveredAmount)} recovered` : ""}
              icon={Trophy}
              accent="amber"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Behavior distribution */}
            <Card className="p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Broker Behavior</h2>
              {behaviorData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={behaviorData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {behaviorData.map((d) => (
                            <Cell key={d.key} fill={BEHAVIOR_COLORS[d.key]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "hsl(222 44% 10%)", border: "1px solid hsl(217 33% 20%)", borderRadius: 8, fontSize: 12, color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {behaviorData.map((d) => (
                      <div key={d.key} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BEHAVIOR_COLORS[d.key] }} />
                          <span className={`px-2 py-0.5 rounded-full ${BEHAVIOR_META[d.key].className}`}>{d.name}</span>
                        </span>
                        <span className="text-muted-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">Not enough resolved claims to classify behavior.</p>
              )}
            </Card>

            {/* Broker leaderboard */}
            <Card className="p-5 lg:col-span-2 overflow-x-auto">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Broker Leaderboard</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <SortTh label="Grade" k="gradeScore" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <th className="pb-2 pr-3 font-medium">Broker</th>
                    <SortTh label="Claims" k="claimCount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh label="Win" k="approvalRate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh label="Claimed" k="totalClaimed" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh label="Recovered" k="recoveredAmount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh label="Rec" k="recoveryRate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh label="Avg Days" k="avgDaysToResolution" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <th className="pb-2 font-medium">Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => (
                    <tr key={b.broker_name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 pr-3">
                        {b.grade.insufficient ? (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">N/D</span>
                        ) : (
                          <span className={cn("font-display font-bold text-2xl", b.grade.color)}>{b.grade.letter}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-medium">
                        <button onClick={() => openPanel("broker", { brokerName: b.broker_name }, { title: b.broker_name })} className="hover:text-primary text-left">
                          {b.broker_name}
                        </button>
                      </td>
                      <td className="py-3 pr-3">{b.claimCount}</td>
                      <td className="py-3 pr-3">
                        <span className={b.approvalRate >= 0.7 ? "text-emerald-400 font-medium" : b.approvalRate < 0.4 ? "text-red-400" : ""}>
                          {fmtPct(b.approvalRate)}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{fmtMoney(b.totalClaimed)}</td>
                      <td className="py-3 pr-3 text-emerald-400">{fmtMoney(b.recoveredAmount)}</td>
                      <td className="py-3 pr-3">
                        <span className={b.recoveryRate >= 0.7 ? "text-emerald-400 font-medium" : b.recoveryRate < 0.4 ? "text-red-400" : ""}>
                          {fmtPct(b.recoveryRate)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">{b.avgDaysToResolution != null ? `${b.avgDaysToResolution}d` : "—"}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BEHAVIOR_META[b.behavior].className}`}>
                          {b.behavior === "at_risk" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {BEHAVIOR_META[b.behavior].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      <PortfolioNegotiation claims={claims || []} onComplete={loadClaims} />
    </div>
  );
}

function SortTh({ label, k, sortKey, sortDir, onClick }) {
  const active = sortKey === k;
  return (
    <th className="pb-2 pr-3 font-medium">
      <button onClick={() => onClick(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}>
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}