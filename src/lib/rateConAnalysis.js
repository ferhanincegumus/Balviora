// Rate confirmation analysis helpers — AI extraction of detention terms
// and generation of broker-facing emails (no-clause request, arrival notification).
import { base44 } from "@/api/base44Client";

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    detention_clause_exists: { type: "boolean" },
    free_time_hours: { type: "number" },
    hourly_rate: { type: "number" },
    notification_requirements: { type: "string" },
    claim_deadline: { type: "string" },
    required_documents: { type: "array", items: { type: "string" } },
    clause_text: { type: "string" },
  },
  required: ["detention_clause_exists", "clause_text"],
};

const EMAIL_SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
};

// Analyze an uploaded rate con file (PDF/image via file_url) or pasted text.
// Returns the strict JSON object from the LLM.
export async function extractRateCon({ fileUrl, text }) {
  let prompt =
    "You are an expert freight detention analyst. Analyze the rate confirmation document (PDF or image) or the pasted text and extract detention terms as strict JSON.\n\n" +
    "Extract these fields:\n" +
    "- detention_clause_exists (boolean): true only if a detention / accessorial / demurrage time clause is explicitly stated.\n" +
    "- free_time_hours (number): free detention time in hours before billing begins. null if not specified.\n" +
    "- hourly_rate (number): detention rate per hour in USD. null if not specified.\n" +
    '- notification_requirements (string): any requirement to notify the broker before free time expires (e.g. "must notify broker before free time expires"). Empty string if none.\n' +
    '- claim_deadline (string): any deadline to submit a detention claim (e.g. "within 30 days of delivery"). Empty string if none.\n' +
    '- required_documents (array of strings): documents required to support a detention claim (e.g. ["BOL","POD","detention slip"]). Empty array if none.\n' +
    "- clause_text (string): the verbatim quote of the detention clause from the document. Empty string if no clause exists.\n\n" +
    "Return ONLY the JSON object. No markdown, no commentary.";

  const params = { prompt, response_json_schema: EXTRACT_SCHEMA };
  if (fileUrl) {
    params.file_urls = [fileUrl];
  } else if (text) {
    params.prompt = `${prompt}\n\n--- RATE CON TEXT ---\n${text}`;
  }
  const res = await base44.integrations.Core.InvokeLLM(params);
  return res;
}

// Generate an email asking the broker to add detention terms in writing
// before the carrier accepts the load (used when no clause exists).
export async function generateNoClauseEmail({ broker_name, load_number, carrier }) {
  const prompt =
    `You are a professional carrier dispatcher. The rate confirmation for load ${load_number || "—"} from broker ${broker_name || "—"} does NOT include a detention clause in writing. Write a short, professional email asking the broker to add detention terms in writing BEFORE the carrier accepts the load. Reference typical terms (e.g. 2 hours free, $50/hr after) and state that the carrier requires detention terms documented before dispatch. Keep it polite but firm.\n\n` +
    `Carrier: ${carrier?.company_name || "[Carrier]"}\nBroker: ${broker_name || "[Broker]"}\nLoad: ${load_number || "—"}\n\n` +
    `Return JSON with "subject" and "body" (plain text).`;
  return base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: EMAIL_SCHEMA });
}

// Generate a pre-written arrival notification email the driver can send to
// the broker when free time is about to expire.
export async function generateNotificationEmail({ broker_name, load_number, free_time_hours, arrival_time, carrier }) {
  const prompt =
    `You are a professional carrier dispatcher. The driver has arrived at the facility for load ${load_number || "—"} (broker: ${broker_name || "—"}) at ${arrival_time ? new Date(arrival_time).toLocaleString() : "—"}. Free detention time is ${free_time_hours || 2} hours. Write a short, professional notification email to the broker stating the driver has arrived and detention time has started, and requesting they note the arrival time. Keep it brief and professional.\n\n` +
    `Carrier: ${carrier?.company_name || "[Carrier]"}\nBroker: ${broker_name || "[Broker]"}\nLoad: ${load_number || "—"}\nArrival: ${arrival_time ? new Date(arrival_time).toLocaleString() : "—"}\nFree time: ${free_time_hours || 2} hours\n\n` +
    `Return JSON with "subject" and "body" (plain text).`;
  return base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: EMAIL_SCHEMA });
}