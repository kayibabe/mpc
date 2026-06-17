import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { visit_id, patient_id, diagnoses, investigations } = await req.json();

    if (!visit_id || !patient_id) {
      return Response.json({ error: 'visit_id and patient_id required' }, { status: 400 });
    }

    const results = [];

    // Auto-generate lab orders from diagnoses
    const diagList = diagnoses || [];
    const investigationList = investigations || [];

    for (const diag of diagList) {
      const d = diag.toLowerCase();
      const tests = [];

      if (d.includes('malaria')) tests.push('Malaria RDT', 'Blood Slide + Parasite Count', 'FBC');
      if (d.includes('pneumonia') || d.includes('urti') || d.includes('respiratory')) tests.push('FBC', 'Chest X-Ray', 'CRP');
      if (d.includes('uti') || d.includes('urinary')) tests.push('Urinalysis', 'Urine MC&S');
      if (d.includes('anemia') || d.includes('anaemia')) tests.push('FBC', 'Iron Studies', 'Peripheral Smear');
      if (d.includes('hypertension')) tests.push('Urea & Electrolytes', 'Creatinine', 'Urinalysis', 'Lipid Profile');
      if (d.includes('diabetes') || d.includes('glucose')) tests.push('Fasting Glucose', 'HbA1c', 'Urinalysis');
      if (d.includes('typhoid') || d.includes('enteric')) tests.push('Widal Test', 'Blood Culture', 'FBC');
      if (d.includes('tb') || d.includes('tuberculosis')) tests.push('GeneXpert MTB/RIF', 'Chest X-Ray', 'FBC');
      if (d.includes('meningitis')) tests.push('CSF Analysis', 'CSF MC&S', 'FBC');
      if (d.includes('hiv')) tests.push('HIV Rapid Test', 'CD4 Count', 'FBC');
      if (d.includes('sepsis') || d.includes('severe') || d.includes('critical')) tests.push('FBC', 'Blood Culture', 'Lactate', 'Urea & Electrolytes', 'LFTs', 'CRP');
      if (d.includes('surgical') || d.includes('preop') || d.includes('pre-op')) tests.push('FBC', 'Group & Crossmatch', 'Urea & Electrolytes', 'Coagulation Profile');

      if (tests.length > 0) {
        results.push({
          diagnosis: diag,
          tests,
        });
      }
    }

    // Also add any explicitly requested investigations
    for (const inv of investigationList) {
      if (!results.find(r => r.tests.includes(inv))) {
        results.push({ diagnosis: 'Clinician requested', tests: [inv] });
      }
    }

    // Create the lab orders
    const createdOrders = [];
    for (const result of results) {
      const order = await base44.entities.LabOrder.create({
        visit_id,
        patient_id,
        tests: JSON.stringify(result.tests),
        status: 'pending',
        priority: 'routine',
        ordered_by: user.id,
        notes: `Auto-generated from diagnoses: ${result.diagnosis}`,
      });
      createdOrders.push({ id: order.id, tests: result.tests, diagnosis: result.diagnosis });
    }

    return Response.json({
      success: true,
      orders_created: createdOrders.length,
      orders: createdOrders,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});