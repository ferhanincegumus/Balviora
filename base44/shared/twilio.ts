// Twilio messaging utility — the ONLY place that knows about Twilio.
// Shared by submitCase (public lead confirmation) and the sendCustomerMessage
// backend function (admin-triggered updates), so provider logic isn't copied.
//
// Sends SMS + WhatsApp to a customer's phone. Requires secrets:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM
// Degrades gracefully — returns { configured: false } when unset, so callers
// (e.g. lead capture) still succeed even before messaging is provisioned.

export async function sendCustomerMessage(phone, body) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const smsFrom = Deno.env.get('TWILIO_SMS_FROM');
  const waFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || (!smsFrom && !waFrom)) {
    return { configured: false, sms: null, whatsapp: null };
  }
  const auth = btoa(`${sid}:${token}`);
  const results = { configured: true, sms: null, whatsapp: null };
  if (smsFrom) {
    results.sms = await twilioSend(auth, smsFrom, phone, body, false).catch((e) => ({
      status: 'failed',
      error: e?.message || 'sms error',
    }));
  }
  if (waFrom) {
    results.whatsapp = await twilioSend(auth, waFrom, phone, body, true).catch((e) => ({
      status: 'failed',
      error: e?.message || 'whatsapp error',
    }));
  }
  return results;
}

async function twilioSend(auth, from, to, body, whatsapp) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', whatsapp ? `whatsapp:${to}` : to);
  form.set('From', whatsapp ? `whatsapp:${from}` : from);
  form.set('Body', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { status: 'failed', error: data?.message || `Twilio ${res.status}`, code: data?.code };
  }
  return { status: 'sent', sid: data?.sid || null };
}