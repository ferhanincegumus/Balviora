import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Scheduled by the "Missing Document Reminders" workflow. Protected by a
// trigger secret so only the scheduled workflow can invoke it — anonymous
// calls are rejected with 403. Logic is otherwise unchanged.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.trigger_secret || req.headers.get('x-trigger-secret');
    if (!secret || secret !== Deno.env.get('DOC_REMINDER_TRIGGER_SECRET')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = Date.now();
    const loads = await sr.entities.Load.list("-departure_time", 200);
    const results = [];
    for (const load of loads) {
      if (!load.departure_time || load.docs_reminder_sent) continue;
      const dep = new Date(load.departure_time).getTime();
      if (now - dep < 3600000) continue;

      const claims = await sr.entities.Claim.filter({ load_id: load.id }).catch(() => []);
      const claim = claims[0];
      const evidences = claim
        ? await sr.entities.Evidence.filter({ claim_id: claim.id }).catch(() => [])
        : [];
      const types = new Set(evidences.map((e) => e.type));
      if (types.has("bol") && types.has("pod")) continue;

      let emailSent = false;
      try {
        if (load.driver_user_id) {
          const driver = await sr.entities.User.get(load.driver_user_id).catch(() => null);
          const to = driver?.email;
          if (to) {
            await sr.integrations.Core.SendEmail({
              to,
              subject: `Missing documents for load ${load.load_number || ""}`,
              body:
                `You departed over an hour ago. Upload your BOL, POD, and signed in/out sheet so your detention claim isn't delayed. ` +
                `Open the app, open your load, and tap "Snap a document".`,
            });
            emailSent = true;
          }
        }
      } catch (_e) {}

      await sr.entities.Load.update(load.id, { docs_reminder_sent: true });
      results.push({ load_id: load.id, emailSent });
    }
    return Response.json({ sent: results, count: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});