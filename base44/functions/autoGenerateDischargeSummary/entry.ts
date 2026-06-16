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

    let admission;
    try {
      admission = await base44.asServiceRole.entities.Admission.get(discharge.admission_id);
    } catch (_) {
      return Response.json({ skipped: true, reason: 'Admission not found' });
    }
    if (!admission) {
      return Response.json({ skipped: true, reason: 'Admission not found' });
    }

    const patient = await base44.asServiceRole.entities.Patient.get(admission.patient_id);

    // Fetch related clinical data
    const [consultations, diagnoses, labOrders, prescriptions] = await Promise.all([
      base44.asServiceRole.entities.Consultation.filter({ patient_id: admission.patient_id }, '-created_date', 20),
      base44.asServiceRole.entities.Diagnosis.filter({ patient_id: admission.patient_id }, '-diagnosis_date', 10),
      base44.asServiceRole.entities.LabOrder.filter({ patient_id: admission.patient_id }, '-created_date', 15),
      base44.asServiceRole.entities.Prescription.filter({ patient_id: admission.patient_id }, '-created_date', 10),
    ]);

    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown';
    const diagnosisList = diagnoses.map(d => d.diagnosis_name).join(', ') || 'None recorded';
    const labCount = labOrders.length;
    const rxCount = prescriptions.length;

    // Generate narrative summary using LLM
    let narrativeSummary = '';
    try {
      const promptStr = `You are a clinical discharge summary writer at Zomba City Private Clinic in Malawi. Write a professional, concise discharge summary using the following clinical data. Include: reason for admission, key clinical findings during stay, investigations done, treatments given, discharge diagnosis, condition at discharge, and follow-up plan. Keep it to 3-4 paragraphs.

Patient: ${patientName}, ${patient?.gender || 'N/A'}, DOB ${patient?.date_of_birth || 'N/A'}, MRN ${patient?.mrn || 'N/A'}
Admission date: ${admission.admission_date || admission.created_date}, type: ${admission.admission_type || 'general'}
Admitting diagnosis: ${admission.diagnosis_on_admission || 'Not recorded'}
Discharge date: ${discharge.discharge_date || 'Not recorded'}
Discharge type: ${discharge.discharge_type || 'N/A'}
Diagnoses during stay: ${diagnosisList}
Total lab orders: ${labCount}
Total prescriptions: ${rxCount}
Follow-up date: ${discharge.follow_up_date || 'Not set'}
Follow-up instructions: ${discharge.follow_up_instructions || 'None'}`;

      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: promptStr,
        model: 'gpt_5_mini',
      });
      narrativeSummary = typeof llmRes === 'string' ? llmRes : llmRes?.response || '';
    } catch (_) {
      narrativeSummary = 'Discharge summary auto-generated. Full clinical narrative unavailable.';
    }

    if (narrativeSummary) {
      await base44.asServiceRole.entities.Discharge.update(discharge.id, {
        discharge_summary: narrativeSummary,
      });
    }

    return Response.json({
      success: true,
      discharge_id: discharge.id,
      summary_stored: !!narrativeSummary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});