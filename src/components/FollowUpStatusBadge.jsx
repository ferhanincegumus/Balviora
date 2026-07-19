import React from "react";
import { cn } from "@/lib/utils";

const styles = {
  scheduled: "bg-blue-500/15 text-blue-400",
  sent: "bg-indigo-500/15 text-indigo-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-slate-500/15 text-slate-400",
};

const labels = {
  scheduled: "Scheduled",
  sent: "Sent",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function FollowUpStatusBadge({ status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        styles[status] || styles.scheduled
      )}
    >
      {labels[status] || status}
    </span>
  );
}