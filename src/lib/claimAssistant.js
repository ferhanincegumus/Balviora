import { differenceInCalendarDays } from "date-fns";
import { computeScore } from "@/lib/claimScore";

// Analyzes a claim and returns a recommended next action (mock AI logic based on
// status, days waiting, and recovery probability).
export function analyzeClaim(claim, load) {
  if (!claim) return null;

  const score = computeScore(claim, load);
  const now = new Date();

  // Days waiting since sent (or since creation)
  const refDate = claim.sent_date ? new Date(claim.sent_date) : claim.created_date ? new Date(claim.created_date) : now;
  const daysWaiting = differenceInCalendarDays(now, refDate);

  let message = "";
  let nextAction = "";

  const terminal = ["approved", "partially_approved", "denied", "paid", "closed"].includes(claim.status);

  if (terminal) {
    if (claim.status === "paid") {
      message = `Payment of $${(claim.paid_amount || claim.approved_amount || 0).toLocaleString()} received. Claim closed.`;
      nextAction = "Archive";
    } else if (claim.status === "approved") {
      message = `Broker approved $${(claim.approved_amount || claim.claim_amount || 0).toLocaleString()}. Awaiting payment.`;
      nextAction = "Mark as paid once funds arrive";
    } else if (claim.status === "partially_approved") {
      message = `Broker partially approved $${(claim.approved_amount || 0).toLocaleString()}. Review whether to accept.`;
      nextAction = "Confirm or dispute the partial approval";
    } else if (claim.status === "denied") {
      message = `Claim denied${claim.denial_reason ? `: ${claim.denial_reason}` : ""}.`;
      nextAction = "Review denial reason and consider escalation";
    } else {
      message = "Claim is closed.";
      nextAction = "No further action";
    }
  } else if (claim.status === "draft" || claim.status === "ready_to_send" || !claim.sent_date) {
    message = `Claim not yet submitted. Recovery probability: ${score}%.`;
    nextAction = "Generate and send the claim email";
  } else if (daysWaiting <= 2) {
    message = `Claim sent ${daysWaiting === 0 ? "today" : `${daysWaiting} day(s) ago`}. Broker has not responded yet. Recovery probability: ${score}%.`;
    nextAction = "Wait for broker response";
  } else if (daysWaiting <= 6) {
    message = `Claim has been waiting ${daysWaiting} days. No broker response. Recovery probability: ${score}%.`;
    nextAction = "Send first follow-up";
  } else if (daysWaiting <= 13) {
    message = `Claim has been waiting ${daysWaiting} days. Broker has not responded. Recovery probability: ${score}%.`;
    nextAction = "Send a stronger reminder";
  } else {
    message = `Claim has been waiting ${daysWaiting} days with no resolution. Recovery probability: ${score}%.`;
    nextAction = "Send escalation message";
  }

  return {
    score,
    daysWaiting,
    message,
    nextAction,
  };
}