// Customer milestone notifier — shared by startRecovery (case opened),
// sendClaimEmail (claim sent), handleInboundEmail (broker replied), and the
// paid-status path. Looks up the customer's phone from the linked Load and
// sends an SMS + WhatsApp via the Twilio util. Best-effort: no-op if the load
// has no customer phone or messaging isn't configured, so recovery flows
// never break over a missing notification.
import { sendCustomerMessage } from "./twilio.ts";

export async function notifyCustomer(base44, loadId, message) {
  if (!loadId || !message) return null;
  let phone;
  try {
    const load = await base44.entities.Load.get(loadId);
    phone = load?.customer_phone;
  } catch {
    try {
      const load = await base44.asServiceRole.entities.Load.get(loadId);
      phone = load?.customer_phone;
    } catch {
      return null;
    }
  }
  if (!phone) return null;
  try {
    return await sendCustomerMessage(String(phone), String(message).slice(0, 1000));
  } catch {
    return null;
  }
}