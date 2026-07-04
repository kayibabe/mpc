import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { journey_ids, priority, notes } = await req.json();
    if (!journey_ids || !Array.isArray(journey_ids) || journey_ids.length === 0) {
      return Response.json({ error: 'journey_ids array is required' }, { status: 400 });
    }
    if (!priority || !['emergency', 'urgent', 'normal'].includes(priority)) {
      return Response.json({ error: 'Valid priority required (emergency, urgent, normal)' }, { status: 400 });
    }

    const results = { triaged: 0, failed: 0, details: [] };

    for (const journeyId of journey_ids) {
      try {
        const journey = await base44.asServiceRole.entities.PatientJourney.get(journeyId);
        if (!journey || journey.current_stage !== 'TRIAGE') {
          results.details.push({ journey_id: journeyId, status: 'skipped', reason: 'Not in TRIAGE stage' });
          continue;
        }

        // Update the visit's priority and queue_status
        const visit = await base44.asServiceRole.entities.Visit.get(journey.visit_id);
        if (visit) {
          await base44.asServiceRole.entities.Visit.update(visit.id, {
            priority: priority,
            queue_status: 'triaged',
          });
        }

        // Transition the journey to CONSULTATION
        await base44.functions.invoke('handleWorkflowStageChange', {
          journey_id: journey.id,
          next_stage: 'CONSULTATION',
          notes: notes || `Bulk triaged as ${priority} by ${user.full_name || 'nursing staff'}`,
        });

        results.triaged++;
        results.details.push({ journey_id: journeyId, status: 'triaged', priority });
      } catch (e) {
        results.failed++;
        results.details.push({ journey_id: journeyId, status: 'failed', error: e.message });
      }
    }

    return Response.json({
      success: true,
      ...results,
      triaged_by: user.id,
      triaged_by_name: user.full_name || user.email,
      triaged_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});