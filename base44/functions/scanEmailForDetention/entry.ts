import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { subject, body, source, email_id } = await req.json();
    if (!body) return Response.json({ error: 'Email body is required' }, { status: 400 });

    // AI extraction of detention-relevant fields from the email.
    const extraction = await base44.integrations.Core.InvokeLLM({
      prompt:
        'You are a freight detention recovery analyst. Read this email (a load confirmation, appointment notice, or broker message) and extract detention-relevant data.\n\n' +
        'Email subject: ' + (subject || '(none)') + '\n' +
        'Email body:\n' + body + '\n\n' +
        'Extract these fields:\n' +
        '- load_number: the load / PO / shipment number\n' +
        '- broker_name: the broker or carrier company\n' +
        '- facility: pickup and/or delivery location\n' +
        '- appointment_time: scheduled appointment time as ISO 8601 (empty string if none)\n' +
        '- arrival_time: driver arrival time as ISO 8601 (empty string if none)\n' +
        '- departure_time: driver departure time as ISO 8601 (empty string if none)\n' +
        '- free_detention_hours: free time allowed before detention (number, 0 if unknown)\n' +
        '- detention_rate_per_hour: detention rate per hour (number, 0 if unknown)\n' +
        '- detention_reason: short note on why detention occurred or evidence present\n\n' +
        'Use empty string for text fields not found, 0 for numbers not found. Return JSON only.',
      response_json_schema: {
        type: 'object',
        properties: {
          load_number: { type: 'string' },
          broker_name: { type: 'string' },
          facility: { type: 'string' },
          appointment_time: { type: 'string' },
          arrival_time: { type: 'string' },
          departure_time: { type: 'string' },
          free_detention_hours: { type: 'number' },
          detention_rate_per_hour: { type: 'number' },
          detention_reason: { type: 'string' }
        }
      }
    });

    const arrRaw = extraction.arrival_time;
    const depRaw = extraction.departure_time;
    const arr = arrRaw ? new Date(arrRaw) : null;
    const dep = depRaw ? new Date(depRaw) : null;

    if (!arr || !dep || isNaN(arr.getTime()) || isNaN(dep.getTime()) || dep <= arr) {
      return Response.json({
        found: false,
        reason: 'No valid arrival/departure times detected in this email.',
        extraction
      });
    }

    const waitHours = (dep - arr) / (1000 * 60 * 60);
    const free = extraction.free_detention_hours > 0 ? extraction.free_detention_hours : 2;
    const rate = extraction.detention_rate_per_hour > 0 ? extraction.detention_rate_per_hour : 50;
    const billable = Math.max(0, waitHours - free);
    const estimated = Math.round(billable * rate);

    if (billable <= 0) {
      return Response.json({
        found: false,
        reason: 'No billable detention detected (within free time).',
        extraction,
        waitHours: Number(waitHours.toFixed(2)),
        billable: 0
      });
    }

    const record = await base44.entities.PotentialRecovery.create({
      source: source || 'manual',
      email_id: email_id || '',
      email_subject: (subject || '').slice(0, 200),
      email_snippet: (body || '').slice(0, 600),
      load_number: extraction.load_number || '',
      broker_name: extraction.broker_name || '',
      facility: extraction.facility || '',
      appointment_time: extraction.appointment_time || null,
      arrival_time: arrRaw,
      departure_time: depRaw,
      free_detention_hours: free,
      detention_rate_per_hour: rate,
      detected_wait_hours: Number(waitHours.toFixed(2)),
      billable_hours: Number(billable.toFixed(2)),
      estimated_amount: estimated,
      status: 'new',
      detention_reason: extraction.detention_reason || '',
      detected_at: new Date().toISOString()
    });

    return Response.json({ found: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});