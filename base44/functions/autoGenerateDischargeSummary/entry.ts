import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    const discharge = data;
    if (!discharge?.admission_id) {
      return Response.json({ skipped: true, reason: 'No admission_id on discharge' });
    }

    // Call the existing generateDischargeSummary function
    const summaryRes = await base44.asServiceRole.functions.invoke('generateDischargeSummary', {
      admission_id: discharge.admission_id,
    });

    const summaryData = summaryRes.data || summaryRes;
    const narrative = summaryData.narrative_summary || '';

    if (narrative) {
      // Store the auto-generated summary back on the discharge record
      await base44.asServiceRole.entities.Discharge.update(discharge.id, {
        discharge_summary: narrative,
      });
    }

    return Response.json({
      success: true,
      discharge_id: discharge.id,
      summary_stored: !!narrative,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});