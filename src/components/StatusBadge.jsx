import React from "react";
import { cn } from "@/lib/utils";

const styles = {
  draft: "bg-muted text-muted-foreground",
  ready_to_send: "bg-blue-500/15 text-blue-400",
  sent: "bg-indigo-500/15 text-indigo-400",
  awaiting_response: "bg-amber-500/15 text-amber-400",
  followup_required: "bg-orange-500/15 text-orange-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  partially_approved: "bg-teal-500/15 text-teal-400",
  denied: "bg-red-500/15 text-red-400",
  paid: "bg-green-500/15 text-green-400",
  closed: "bg-slate-500/15 text-slate-400",
  // legacy compat
  generated: "bg-blue-500/15 text-blue-400",
  rejected: "bg-red-500/15 text-red-400",
};

const labels = {
  draft: "Draft",
  ready_to_send: "Ready to Send",
  sent: "Sent",
  awaiting_response: "Awaiting Response",
  followup_required: "Follow-up Required",
  approved: "Approved",
  partially_approved: "Partially Approved",
  denied: "Denied",
  paid: "Paid",
  closed: "Closed",
  generated: "Generated",
  rejected: "Rejected",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        styles[status] || styles.draft
      )}
    >
      {labels[status] || status}
    </span>
  );
}