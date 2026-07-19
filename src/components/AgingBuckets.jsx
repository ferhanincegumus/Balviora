import React from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Hourglass, AlertTriangle } from "lucide-react";

const TERMINAL = ["approved", "partially_approved", "denied", "paid", "closed"];

const BUCKETS = [
  { key: "0_7", label: "0–7 days", min: 0, max: 7, ring: "border-l-emerald-500", text: "text-emerald-400" },
  { key: "8_14", label: "8–14 days", min: 8, max: 14, ring: "border-l-amber-500", text: "text-amber-400" },
  { key: "15_30", label: "15–30 days", min: 15, max: 30, ring: "border-l-orange-500", text: "text-orange-400" },
  { key: "30_plus", label: "30+ days", min: 31, max: Infinity, ring: "border-l-red-500", text: "text-red-400" },
];

export default function AgingBuckets({ claims }) {
  const open = (claims || []).filter((c) => !TERMINAL.includes(c.status) && c.sent_date);
  const now = new Date();

  const buckets = BUCKETS.map((b) => {
    const items = open.filter((c) => {
      const days = differenceInCalendarDays(now, new Date(c.sent_date));
      return days >= b.min && days <= b.max;
    });
    return { ...b, count: items.length, amount: items.reduce((s, c) => s + Number(c.claim_amount || 0), 0) };
  });

  const total = open.reduce((s, c) => s + Number(c.claim_amount || 0), 0);
  if (total === 0) return null;

  const atRisk = buckets.find((b) => b.key === "30_plus");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Hourglass className="w-5 h-5 text-primary" /> Recovery at risk by age
        </h2>
        <span className="text-sm text-muted-foreground">
          {open.length} submitted · ${total.toLocaleString()} pending
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map((b) => (
          <Card key={b.key} className={`p-5 border-l-4 ${b.ring}`}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.label}</p>
            <p className={`text-2xl font-bold mt-1 ${b.text}`}>${b.amount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {b.count} claim{b.count !== 1 ? "s" : ""}
            </p>
          </Card>
        ))}
      </div>
      {atRisk?.count > 0 && (
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                {atRisk.count} claim{atRisk.count !== 1 ? "s" : ""} aging past 30 days — ${atRisk.amount.toLocaleString()} at risk
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recovery probability drops sharply after 30 days. Prioritize these immediately.
              </p>
            </div>
            <Link to="/claims" className="text-sm text-primary hover:underline shrink-0 self-center">
              Review →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}