import React from "react";
import { cn } from "@/lib/utils";
import { FileText, Send, Mail, CheckCircle, DollarSign, Clock, PlusCircle } from "lucide-react";

// Builds an ordered timeline of events from the claim record.
export function buildTimeline(claim) {
  const events = [];

  // Created
  if (claim.created_date) {
    events.push({ key: "created", label: "Claim created", date: claim.created_date, icon: PlusCircle, tone: "slate" });
  }

  // Submitted / sent
  if (claim.sent_date) {
    events.push({ key: "submitted", label: "Claim submitted to broker", date: claim.sent_date, icon: Send, tone: "indigo" });
  } else if (claim.generated_at) {
    events.push({ key: "generated", label: "Email generated", date: claim.generated_at, icon: FileText, tone: "blue" });
  }

  // Follow-ups
  if (claim.last_followup_date) {
    events.push({ key: "followup", label: "Follow-up sent", date: claim.last_followup_date, icon: Mail, tone: "amber" });
  }

  // Response received
  if (claim.response_date) {
    events.push({ key: "response", label: "Response received", date: claim.response_date, icon: Clock, tone: "orange" });
  }

  // Approved
  if (["approved", "partially_approved", "paid", "closed"].includes(claim.status)) {
    const date = claim.response_date || claim.updated_date || claim.sent_date;
    events.push({
      key: "approved",
      label: claim.status === "partially_approved" ? "Partially approved" : "Approved",
      date,
      icon: CheckCircle,
      tone: "emerald",
    });
  }

  // Denied
  if (claim.status === "denied") {
    events.push({
      key: "denied",
      label: "Denied",
      date: claim.response_date || claim.updated_date,
      icon: CheckCircle,
      tone: "red",
    });
  }

  // Paid
  if (claim.status === "paid" || (claim.paid_amount && claim.paid_amount > 0)) {
    events.push({
      key: "paid",
      label: "Payment received",
      date: claim.updated_date,
      icon: DollarSign,
      tone: "green",
    });
  }

  // Sort by date ascending (undated items first)
  return events.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : Infinity;
    const db = b.date ? new Date(b.date).getTime() : Infinity;
    return da - db;
  });
}

const toneStyles = {
  slate: "bg-slate-500/15 text-slate-400",
  blue: "bg-blue-500/15 text-blue-400",
  indigo: "bg-indigo-500/15 text-indigo-400",
  amber: "bg-amber-500/15 text-amber-400",
  orange: "bg-orange-500/15 text-orange-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  green: "bg-green-500/15 text-green-400",
};

export default function ClaimTimeline({ claim }) {
  const events = buildTimeline(claim);

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No timeline events yet.</p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {events.map((e) => (
        <li key={e.key} className="ml-5">
          <span className={cn("absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-background", toneStyles[e.tone])}>
            <e.icon className="w-3 h-3" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{e.label}</p>
            {e.date && (
              <time className="text-xs text-muted-foreground">
                {new Date(e.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}