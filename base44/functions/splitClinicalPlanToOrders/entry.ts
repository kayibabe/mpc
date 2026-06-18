import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data?.visit_id || !data?.patient_id || !data?.id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let ordersGenerated = 0;

    // Process lab tests
    if (data.lab_tests) {
      try {
        const tests = JSON.parse(data.lab_tests);
        for (const test of tests) {
          await base44.asServiceRole.entities.LabOrder.create({
            visit_id: data.visit_id,
            patient_id: data.patient_id,
            tests: JSON.stringify([test.test_name]),
            ordered_by: data.doctor_id || data.doctor_name,
            order_date: new Date().toISOString(),
            status: "ordered",
            priority: test.priority || "routine",
            specimen_type: test.specimen_type || "blood",
            clinical_notes: test.clinical_notes || "",
          });
          ordersGenerated++;
        }
      } catch (e) {
        console.error("Error processing lab tests:", e);
      }
    }

    // Process imaging studies
    if (data.imaging_studies) {
      try {
        const studies = JSON.parse(data.imaging_studies);
        for (const study of studies) {
          await base44.asServiceRole.entities.ImagingOrder.create({
            visit_id: data.visit_id,
            patient_id: data.patient_id,
            ordered_by: data.doctor_id || data.doctor_name,
            order_date: new Date().toISOString(),
            study_type: study.study_type || "xray",
            body_part: study.body_part || study.study_type,
            clinical_indication: study.clinical_indication || "",
            status: "ordered",
            priority: study.priority || "routine",
          });
          ordersGenerated++;
        }
      } catch (e) {
        console.error("Error processing imaging studies:", e);
      }
    }

    // Process medications
    if (data.medications) {
      try {
        const meds = JSON.parse(data.medications);
        if (meds.length > 0) {
          const prescription = await base44.asServiceRole.entities.Prescription.create({
            visit_id: data.visit_id,
            patient_id: data.patient_id,
            prescribed_by: data.doctor_id || data.doctor_name,
            prescription_date: new Date().toISOString(),
            status: "draft",
            notes: data.clinical_notes || "",
          });

          for (const med of meds) {
            await base44.asServiceRole.entities.PrescriptionItem.create({
              prescription_id: prescription.id,
              drug_name: med.drug_name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration || "",
              route: med.route || "oral",
              quantity: med.quantity || 1,
              instructions: med.instructions || "",
              status: "pending",
            });
          }
          ordersGenerated++;
        }
      } catch (e) {
        console.error("Error processing medications:", e);
      }
    }

    // Process procedures
    if (data.procedures) {
      try {
        const procedures = JSON.parse(data.procedures);
        for (const proc of procedures) {
          await base44.asServiceRole.entities.SurgicalBooking.create({
            patient_id: data.patient_id,
            visit_id: data.visit_id,
            surgeon_id: data.doctor_id,
            surgeon_name: data.doctor_name,
            theater_room: "theatre_1",
            procedure_name: proc.procedure_name,
            procedure_category: proc.category || "general",
            scheduled_date: new Date().toISOString().slice(0, 10),
            start_time: "09:00",
            end_time: "11:00",
            estimated_duration_minutes: proc.estimated_duration || 120,
            anaesthesia_type: proc.anaesthesia_type || "general",
            priority: proc.priority || "elective",
            status: "scheduled",
            preop_notes: data.clinical_notes || "",
            booked_by: data.doctor_name || "System",
            booked_by_name: data.doctor_name || "System",
          });
          ordersGenerated++;
        }
      } catch (e) {
        console.error("Error processing procedures:", e);
      }
    }

    // Update ClinicalPlan status
    await base44.asServiceRole.entities.ClinicalPlan.update(data.id, {
      status: "processed",
      orders_generated: ordersGenerated,
    });

    return Response.json({
      status: "success",
      orders_generated: ordersGenerated,
      plan_id: data.id,
    });

  } catch (error) {
    console.error("Error splitting clinical plan:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});