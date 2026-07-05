import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const HARDCODED_INTERACTIONS = [
  { drug_a: "co-trimoxazole", drug_b: "methotrexate", severity: "contraindicated", description: "Increased methotrexate toxicity — bone marrow suppression", recommendation: "Avoid combination. Use alternative antibiotic." },
  { drug_a: "warfarin", drug_b: "co-trimoxazole", severity: "major", description: "Potentiated anticoagulation — risk of bleeding", recommendation: "Monitor INR closely. Consider dose reduction." },
  { drug_a: "warfarin", drug_b: "metronidazole", severity: "major", description: "Enhanced anticoagulant effect", recommendation: "Reduce warfarin dose by 30-50%. Monitor INR." },
  { drug_a: "warfarin", drug_b: "ibuprofen", severity: "contraindicated", description: "GI bleeding risk significantly increased", recommendation: "Use paracetamol instead. If NSAID essential, add PPI." },
  { drug_a: "warfarin", drug_b: "diclofenac", severity: "contraindicated", description: "GI bleeding risk significantly increased", recommendation: "Use paracetamol instead. If NSAID essential, add PPI." },
  { drug_a: "warfarin", drug_b: "aspirin", severity: "contraindicated", description: "Synergistic bleeding risk", recommendation: "Avoid combination." },
  { drug_a: "gentamicin", drug_b: "furosemide", severity: "major", description: "Increased ototoxicity and nephrotoxicity", recommendation: "Monitor renal function and hearing. Consider alternative diuretic." },
  { drug_a: "gentamicin", drug_b: "ceftriaxone", severity: "moderate", description: "Additive nephrotoxicity risk", recommendation: "Monitor renal function." },
  { drug_a: "metformin", drug_b: "furosemide", severity: "moderate", description: "Furosemide may reduce metformin efficacy", recommendation: "Monitor blood glucose. May need metformin dose adjustment." },
  { drug_a: "metformin", drug_b: "prednisolone", severity: "moderate", description: "Corticosteroids raise blood glucose — reduced metformin effect", recommendation: "Monitor blood glucose closely. Adjust metformin dose." },
  { drug_a: "enalapril", drug_b: "ibuprofen", severity: "moderate", description: "NSAIDs reduce antihypertensive effect. Increased risk of renal impairment.", recommendation: "Monitor BP and renal function." },
  { drug_a: "enalapril", drug_b: "diclofenac", severity: "moderate", description: "NSAIDs reduce antihypertensive effect. Increased risk of renal impairment.", recommendation: "Monitor BP and renal function." },
  { drug_a: "enalapril", drug_b: "spironolactone", severity: "major", description: "Risk of life-threatening hyperkalemia", recommendation: "Avoid combination. Monitor potassium." },
  { drug_a: "artemether_lumefantrine", drug_b: "warfarin", severity: "moderate", description: "Possible reduced anticoagulant effect", recommendation: "Monitor INR." },
  { drug_a: "artemether_lumefantrine", drug_b: "metformin", severity: "minor", description: "Minimal interaction risk", recommendation: "No action required." },
  { drug_a: "ciprofloxacin", drug_b: "warfarin", severity: "major", description: "Enhanced anticoagulant effect", recommendation: "Monitor INR closely. Reduce warfarin dose." },
  { drug_a: "ciprofloxacin", drug_b: "theophylline", severity: "major", description: "Risk of theophylline toxicity — seizures, arrhythmias", recommendation: "Reduce theophylline dose. Monitor levels." },
  { drug_a: "erythromycin", drug_b: "warfarin", severity: "major", description: "Enhanced anticoagulant effect", recommendation: "Monitor INR. Reduce warfarin dose." },
  { drug_a: "fluconazole", drug_b: "warfarin", severity: "major", description: "Marked increase in anticoagulant effect", recommendation: "Reduce warfarin dose by 30-50%. Monitor INR." },
  { drug_a: "rifampicin", drug_b: "warfarin", severity: "major", description: "Reduced anticoagulant effect", recommendation: "Increase warfarin dose. Monitor INR." },
  { drug_a: "rifampicin", drug_b: "oral_contraceptive", severity: "major", description: "Reduced contraceptive efficacy", recommendation: "Use additional barrier contraception." },
  { drug_a: "phenytoin", drug_b: "co-trimoxazole", severity: "moderate", description: "Increased phenytoin levels", recommendation: "Monitor phenytoin levels." },
  { drug_a: "digoxin", drug_b: "furosemide", severity: "moderate", description: "Hypokalemia increases digoxin toxicity risk", recommendation: "Monitor potassium. Supplement if needed." },
  { drug_a: "digoxin", drug_b: "erythromycin", severity: "major", description: "Increased digoxin absorption — toxicity risk", recommendation: "Monitor digoxin levels. Reduce dose." },
  { drug_a: "lithium", drug_b: "ibuprofen", severity: "major", description: "Increased lithium levels — toxicity risk", recommendation: "Monitor lithium levels. Reduce dose." },
  { drug_a: "lithium", drug_b: "diclofenac", severity: "major", description: "Increased lithium levels — toxicity risk", recommendation: "Monitor lithium levels. Reduce dose." },
  { drug_a: "lithium", drug_b: "furosemide", severity: "moderate", description: "Altered lithium excretion", recommendation: "Monitor lithium levels." },
  { drug_a: "amitriptyline", drug_b: "co-trimoxazole", severity: "moderate", description: "Possible additive cardiotoxicity", recommendation: "Monitor ECG if high doses." },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { patient_id, drugs } = body;

    if (!patient_id) return Response.json({ error: 'patient_id required' }, { status: 400 });
    if (!drugs || !Array.isArray(drugs) || drugs.length === 0) {
      return Response.json({ error: 'drugs array required' }, { status: 400 });
    }

    const warnings = [];
    const drugNames = drugs.map(d => (d.generic_name || d.drug_name || '').toLowerCase().replace(/\s+/g, '_'));

    // 1. Check patient allergies
    const allergies = await base44.entities.PatientAllergy.filter(
      { patient_id },
      "",
      50
    );

    for (const drug of drugs) {
      const name = drug.drug_name || drug.generic_name || '';
      const lowerName = name.toLowerCase();
      for (const allergy of allergies) {
        if (lowerName.includes(allergy.allergen.toLowerCase()) || allergy.allergen.toLowerCase().includes(lowerName)) {
          warnings.push({
            type: 'allergy',
            severity: allergy.severity || 'severe',
            drug: name,
            allergen: allergy.allergen,
            reaction: allergy.reaction || 'Unknown reaction',
            message: `⚠️ ${name} — Patient has ${allergy.severity || 'known'} allergy to ${allergy.allergen} (${allergy.reaction || 'reaction documented'})`,
          });
        }
      }
    }

    // 2. Check drug-drug interactions (hardcoded + database)
    const dbInteractions = await base44.asServiceRole.entities.DrugInteraction.filter(
      { is_active: true },
      "",
      200
    );

    const allInteractions = [...HARDCODED_INTERACTIONS];

    for (const dbInt of dbInteractions) {
      const a = (dbInt.drug_a || '').toLowerCase().replace(/\s+/g, '_');
      const b = (dbInt.drug_b || '').toLowerCase().replace(/\s+/g, '_');
      allInteractions.push({
        drug_a: a, drug_b: b,
        severity: dbInt.severity,
        description: dbInt.description,
        recommendation: dbInt.recommendation || '',
      });
    }

    for (let i = 0; i < drugNames.length; i++) {
      for (let j = i + 1; j < drugNames.length; j++) {
        const a = drugNames[i];
        const b = drugNames[j];
        for (const interaction of allInteractions) {
          const match =
            (a.includes(interaction.drug_a) && b.includes(interaction.drug_b)) ||
            (a.includes(interaction.drug_b) && b.includes(interaction.drug_a));
          if (match) {
            warnings.push({
              type: 'interaction',
              severity: interaction.severity,
              drug_a: drugs[i].drug_name || drugs[i].generic_name,
              drug_b: drugs[j].drug_name || drugs[j].generic_name,
              description: interaction.description,
              recommendation: interaction.recommendation,
              message: `${interaction.severity.toUpperCase()}: ${interaction.description} — ${interaction.recommendation}`,
            });
          }
        }
      }
    }

    // 3. Check for duplicate therapy (same drug class)
    const seenClasses = {};
    for (const drug of drugs) {
      const cls = (drug.category || '').toLowerCase();
      if (cls && seenClasses[cls]) {
        warnings.push({
          type: 'duplicate',
          severity: 'moderate',
          drug: drug.drug_name || drug.generic_name,
          category: cls,
          message: `Duplicate class: ${drug.drug_name || drug.generic_name} — same class as another prescribed drug (${cls}). Review.`,
        });
      }
      if (cls) seenClasses[cls] = true;
    }

    const safe = warnings.length === 0;
    const contraindicatedCount = warnings.filter(w => w.severity === 'contraindicated').length;
    const majorCount = warnings.filter(w => w.severity === 'major').length;

    return Response.json({
      safe,
      warnings,
      summary: safe
        ? '✅ No safety concerns found.'
        : `${warnings.length} warning${warnings.length > 1 ? 's' : ''} — ${contraindicatedCount} contraindicated, ${majorCount} major`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});