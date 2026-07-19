import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Decodes Gmail base64url body payload to plain text.
function decodeB64(s) {
  try {
    return atob((s || '').replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return '';
  }
}

function stripHtml(h) {
  return (h || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function gmailBodyText(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    const mt = payload.mimeType || '';
    const txt = decodeB64(payload.body.data);
    return mt === 'text/html' ? stripHtml(txt) : txt;
  }
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
    if (plain) return decodeB64(plain.body.data);
    const html = payload.parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
    if (html) return stripHtml(decodeB64(html.body.data));
    for (const p of payload.parts) {
      const inner = gmailBodyText(p);
      if (inner) return inner;
    }
  }
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { connectorId, source, maxResults } = await req.json();
    if (!connectorId) return Response.json({ error: 'connectorId is required' }, { status: 400 });
    if (!['gmail', 'outlook'].includes(source)) {
      return Response.json({ error: 'source must be "gmail" or "outlook"' }, { status: 400 });
    }
    const limit = Math.min(maxResults || 25, 50);

    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);

    const messages = [];
    if (source === 'gmail') {
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + limit +
          '&q=subject:(load OR appointment OR detention OR confirmation)',
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      if (!listRes.ok) return Response.json({ error: 'Gmail list failed: ' + listRes.status }, { status: 502 });
      const listData = await listRes.json();
      for (const m of (listData.messages || [])) {
        const fullRes = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=full',
          { headers: { Authorization: 'Bearer ' + accessToken } }
        );
        if (!fullRes.ok) continue;
        const msg = await fullRes.json();
        const subject = (msg.payload?.headers || []).find((h) => h.name.toLowerCase() === 'subject')?.value || '';
        messages.push({ id: m.id, subject, body: gmailBodyText(msg.payload) });
      }
    } else {
      const graphRes = await fetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=' + limit +
          '&$select=subject,body&$search="load OR appointment OR detention"',
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      if (!graphRes.ok) return Response.json({ error: 'Graph list failed: ' + graphRes.status }, { status: 502 });
      const graphData = await graphRes.json();
      for (const m of (graphData.value || [])) {
        messages.push({ id: m.id, subject: m.subject || '', body: stripHtml(m.body?.content || '') });
      }
    }

    // Run each email through the AI extraction + create flow.
    const results = [];
    let found = 0;
    for (const msg of messages) {
      try {
        const r = await base44.functions.invoke('scanEmailForDetention', {
          subject: msg.subject,
          body: msg.body,
          source,
          email_id: msg.id
        });
        const d = r.data ?? r;
        if (d && d.found) found++;
        results.push({ subject: msg.subject, found: !!(d && d.found), recordId: d && d.record ? d.record.id : null });
      } catch (e) {
        results.push({ subject: msg.subject, error: e.message });
      }
    }

    return Response.json({ scanned: messages.length, found, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});