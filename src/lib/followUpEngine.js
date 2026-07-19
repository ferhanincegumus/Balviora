import { base44 } from "@/api/base44Client";
import { differenceInCalendarDays } from "date-fns";
import { computeScore } from "@/lib/claimScore";

// Standard follow-up cadence: Day 3 (first reminder), Day 7 (escalation), Day 14 (final notice).
export const FOLLOW_UP_TYPES = [
  { value: "day_7", label: "Day 7 — First Follow-up", delayDays: 7, urgency: "medium" },
  { value: "day_14", label: "Day 14 — Escalation", delayDays: 14, urgency: "high" },
  { value: "day_30", label: "Day 30 — Final Notice (BMC-84)", delayDays: 30, urgency: "critical" },
];

export function typeMeta(type) {
  return FOLLOW_UP_TYPES.find((t) => t.value === type) || FOLLOW_UP_TYPES[0];
}

// Day 0: when a claim becomes "sent", idempotently schedule the three standard follow-ups.
export async function scheduleFollowUpsForClaim(claimId, claim) {
  if (!claim) {
    try {
      claim = await base44.entities.Claim.get(claimId);
    } catch {
      return;
    }
  }
  if (!claim || !claim.sent_date) return;

  let existing = [];
  try {
    existing = await base44.entities.FollowUp.filter({ claim_id: claimId }, undefined, 50);
  } catch {}

  const sentDate = new Date(claim.sent_date);
  for (const t of FOLLOW_UP_TYPES) {
    if (existing.some((f) => f.type === t.value)) continue;
    const scheduledDate = new Date(sentDate.getTime() + t.delayDays * 86400000);
    await base44.entities.FollowUp.create({
      claim_id: claimId,
      carrier_id: claim.created_by_id || undefined,
      follow_up_number: t.delayDays,
      scheduled_date: scheduledDate.toISOString(),
      status: "scheduled",
      type: t.value,
    });
  }
}

export function getDaysWaiting(claim) {
  if (!claim || !claim.sent_date) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(claim.sent_date)));
}

// AI logic: determine follow-up urgency + recommended action for an open claim.
export function getFollowUpUrgency(claim) {
  const days = getDaysWaiting(claim);
  const terminal = ["approved", "partially_approved", "denied", "paid", "closed"].includes(claim?.status);
  if (terminal) {
    return { urgency: "none", action: "Resolved", due: false, type: null, days };
  }
  if (days >= 30) {
    return { urgency: "critical", action: "Send final notice — file BMC-84 claim", due: true, type: "day_30", days };
  }
  if (days >= 14) {
    return { urgency: "high", action: "Send escalation email today", due: true, type: "day_14", days };
  }
  if (days >= 7) {
    return { urgency: "medium", action: "Send first follow-up", due: true, type: "day_7", days };
  }
  return { urgency: "low", action: "Waiting for broker response", due: false, type: null, days };
}

// Builds the AI prompt using broker name, claim amount, load number, detention reason,
// evidence available, and previous communication history.
export function buildFollowUpPrompt(claim, load, carrier, type, previousFollowups = []) {
  const cp = carrier || {};
  const t = typeMeta(type);
  const l = load || {};

  const evidence = [
    l.arrival_time && "Driver arrival timestamp",
    l.departure_time && "Driver departure timestamp",
    l.appointment_time && "Appointment confirmation",
    l.pickup_location && l.delivery_location && "Route documentation",
  ].filter(Boolean);

  const previousHistory = previousFollowups.length > 0
    ? previousFollowups.map((f, i) => `  ${i + 1}. ${typeMeta(f.type).label} sent on ${new Date(f.sent_date).toLocaleDateString()}`).join("\n")
    : "  None — this is the first follow-up.";

  let tone = "";
  if (type === "day_7") {
    tone = "This is the FIRST follow-up, sent 7 days after the original claim. The broker has not responded. Be polite and professional but clearly request a status update on payment.";
  } else if (type === "day_14") {
    tone = "This is a SECOND, STRONGER request sent 14 days after the original claim. Payment is now overdue. Be firmer and request immediate attention.";
  } else {
    tone = "This is the FINAL notice sent 30 days after the original claim. The claim remains unpaid with no response. Be formal and firm. State that if payment is not received within 5 business days, a claim will be filed against the broker's surety bond (BMC-84) pursuant to 49 CFR Part 1043, as required for licensed freight brokers.";
  }

  return `You are a professional freight carrier following up on an UNPAID detention time claim with a broker. ${tone}

Carrier details:
- Company: ${cp.company_name || "[Carrier]"}
- Owner: ${cp.owner_name || ""}
- MC#: ${cp.mc_number || "N/A"}
- DOT#: ${cp.dot_number || "N/A"}

Load details:
- Broker: ${claim.broker_name || l.broker_name || "[Broker]"}
- Load number: ${claim.load_number || l.load_number || "N/A"}
- Pickup: ${l.pickup_location || "N/A"}
- Delivery: ${l.delivery_location || "N/A"}

Detention reason:
- Appointment: ${l.appointment_time || "N/A"}
- Driver arrival: ${l.arrival_time || "N/A"}
- Driver departure: ${l.departure_time || "N/A"}
- Total wait time: ${Number(l.total_wait_hours || 0).toFixed(2)} hours
- Free detention: ${l.free_detention_hours || 0} hours
- Billable hours: ${Number(l.billable_hours || 0).toFixed(2)} hours
- Detention rate: $${l.contract_rate || l.detention_rate_per_hour || 0}/hour
- Total claim amount: $${Number(claim.claim_amount || 0).toFixed(2)}

Evidence available:
${evidence.length > 0 ? evidence.map((e) => `  - ${e}`).join("\n") : "  - Timestamps on file"}

Previous communication history:
${previousHistory}

Write a professional follow-up email with:
1. A clear subject line mentioning the load number and "Detention Time Claim".
2. A polite greeting to the broker.
3. A reference to the original claim that remains unpaid.
4. A brief restatement of the billable hours and total amount requested.
5. A clear request for an update on payment status.
6. A polite closing signed with the carrier company name.

Return JSON with "subject" and "body" fields. The body should be plain text with line breaks.`;
}

export async function generateFollowUpEmail(claim, load, carrier, type, previousFollowups = []) {
  const prompt = buildFollowUpPrompt(claim, load, carrier, type, previousFollowups);
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: { subject: { type: "string" }, body: { type: "string" } },
    },
  });
  return { subject: res.subject || "", body: res.body || "" };
}

// Marks a follow-up as sent, stores the email content, and updates the claim lifecycle.
export async function sendFollowUp(followUpId, email, claimId) {
  const now = new Date().toISOString();
  await base44.entities.FollowUp.update(followUpId, {
    status: "sent",
    sent_date: now,
    email_subject: email.subject,
    email_content: email.body,
  });
  await base44.entities.Claim.update(claimId, {
    status: "followup_required",
    last_followup_date: now,
    next_followup_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    email_subject: email.subject,
    email_body: email.body,
  });
}

// Resolve all open follow-ups for a claim (broker responded / manually resolved).
export async function resolveFollowUpsForClaim(claimId) {
  let followups = [];
  try {
    followups = await base44.entities.FollowUp.filter({ claim_id: claimId }, undefined, 50);
  } catch {}
  const open = followups.filter((f) => f.status === "scheduled");
  if (open.length === 0) return 0;
  await base44.entities.FollowUp.bulkUpdate(open.map((f) => ({ id: f.id, status: "completed" })));
  return open.length;
}