import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Thin email provider layer — the ONLY place that knows about Resend.
// Swapping providers later means editing only this file. Called server-side
// by sendClaimEmail and sendClaimReply, so it requires an authenticated user
// (functions.invoke forwards the caller's auth context).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { to, subject, text, html, headers, replyTo } = body;
    if (!to || !subject) return Response.json({ error: 'to and subject required' }, { status: 400 });

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      return Response.json({ error: 'Email provider not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).' }, { status: 500 });
    }

    const payload = {
      from: `Detention Recover <${fromEmail}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      headers: headers || undefined,
      reply_to: replyTo || undefined,
    };

    let providerId = null;
    let status = 'delivered';
    let message = '';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        status = 'failed';
        message = data?.message || data?.error || `Resend returned ${res.status}`;
      } else {
        providerId = data?.id || null;
      }
    } catch (e) {
      status = 'failed';
      message = e?.message || 'Network error contacting Resend';
    }
    return Response.json({ status, providerId, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});