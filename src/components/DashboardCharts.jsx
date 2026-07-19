import React, { useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card } from "@/components/ui/card";

const STATUS_COLORS = {
  draft: "#64748b",
  ready_to_send: "#3b82f6",
  sent: "#6366f1",
  awaiting_response: "#f59e0b",
  followup_required: "#f97316",
  approved: "#10b981",
  partially_approved: "#14b8a6",
  denied: "#ef4444",
  paid: "#22c55e",
  closed: "#94a3b8",
  // legacy
  generated: "#3b82f6",
  rejected: "#ef4444",
};

const STATUS_LABELS = {
  draft: "Draft",
  ready_to_send: "Ready",
  sent: "Sent",
  awaiting_response: "Waiting",
  followup_required: "Follow-up",
  approved: "Approved",
  partially_approved: "Partial",
  denied: "Denied",
  paid: "Paid",
  closed: "Closed",
  generated: "Generated",
  rejected: "Rejected",
};

const tooltipStyle = {
  backgroundColor: "hsl(222 44% 10%)",
  border: "1px solid hsl(217 33% 20%)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
};

export default function DashboardCharts({ claims }) {
  const monthly = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("default", { month: "short" }), amount: 0 });
    }
    const map = new Map(months.map((m) => [m.key, m]));
    claims
      .filter((c) => ["approved", "partially_approved", "paid"].includes(c.status))
      .forEach((c) => {
        const dateStr = c.generated_at || c.created_date;
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (map.has(key)) map.get(key).amount += c.approved_amount || c.claim_amount || 0;
      });
    return months.map((m) => ({ name: m.label, recovered: Number(m.amount.toFixed(2)) }));
  }, [claims]);

  const statusData = useMemo(() => {
    const counts = {};
    claims.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value, color: STATUS_COLORS[name] || "#64748b" }));
  }, [claims]);

  // Recovery performance — monthly submitted vs recovered amounts
  const performance = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("default", { month: "short" }), submitted: 0, recovered: 0 });
    }
    const map = new Map(months.map((m) => [m.key, m]));
    claims.forEach((c) => {
      const submittedStr = c.sent_date || c.generated_at || c.created_date;
      if (submittedStr) {
        const d = new Date(submittedStr);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (map.has(key)) map.get(key).submitted += c.claim_amount || 0;
        }
      }
      if (["approved", "partially_approved", "paid"].includes(c.status)) {
        const dStr = c.response_date || c.generated_at || c.created_date;
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d)) {
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (map.has(key)) map.get(key).recovered += c.approved_amount || c.claim_amount || 0;
          }
        }
      }
    });
    return months.map((m) => ({
      name: m.label,
      Submitted: Number(m.submitted.toFixed(2)),
      Recovered: Number(m.recovered.toFixed(2)),
    }));
  }, [claims]);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly recovered revenue trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(59,130,246,0.08)" }} formatter={(v) => [`$${v.toLocaleString()}`, "Recovered"]} />
              <Bar dataKey="recovered" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Claim status distribution</h2>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-20 text-center">No claims to chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {statusData.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recovery performance — submitted vs recovered</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={performance} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
            <Line type="monotone" dataKey="Submitted" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Recovered" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}