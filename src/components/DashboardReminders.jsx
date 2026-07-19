import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";

export default function DashboardReminders({ claims }) {
  const upcoming = (claims || [])
    .filter((c) => ["sent", "awaiting_response", "followup_required"].includes(c.status) || (c.sent_date && !["approved", "partially_approved", "denied", "paid", "closed"].includes(c.status)))
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" /> Upcoming follow-ups
        </h2>
        <span className="text-sm text-muted-foreground">{upcoming.length} awaiting action</span>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Load #</th>
                <th className="px-4 py-3 font-medium">Broker</th>
                <th className="px-4 py-3 font-medium text-right">Claim</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/claims/${c.id}`} className="hover:text-primary">{c.load_number || "—"}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.broker_name || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">${(c.claim_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/claims/${c.id}`} className="inline-flex items-center text-primary hover:underline">
                      Follow up <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}