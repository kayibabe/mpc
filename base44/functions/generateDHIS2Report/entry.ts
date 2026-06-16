import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { period, report_type } = await req.json();
    if (!period || !report_type) return Response.json({ error: 'Missing period or report_type' }, { status: 400 });

    // Parse period (e.g. "2026-06")
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Fetch all relevant data for the period
    const [visits, labOrders, maternalVisits, diagnoses, admissions, newborns, immunizations] = await Promise.all([
      base44.asServiceRole.entities.Visit.filter({}, '', 5000).then(vs =>
        vs.filter(v => v.created_date >= startDate && v.created_date <= endDate)
      ),
      base44.asServiceRole.entities.LabOrder.filter({}, '', 5000).then(ls =>
        ls.filter(l => l.created_date >= startDate && l.created_date <= endDate)
      ),
      base44.asServiceRole.entities.MaternalVisit.filter({}, '', 5000).then(vs =>
        vs.filter(v => v.created_date >= startDate && v.created_date <= endDate)
      ),
      base44.asServiceRole.entities.Diagnosis.filter({}, '', 5000).then(ds =>
        ds.filter(d => d.created_date >= startDate && d.created_date <= endDate)
      ),
      base44.asServiceRole.entities.Admission.filter({}, '', 5000).then(as =>
        as.filter(a => a.created_date >= startDate && a.created_date <= endDate)
      ),
      base44.asServiceRole.entities.NewbornRecord.filter({}, '', 5000).then(ns =>
        ns.filter(n => n.created_date >= startDate && n.created_date <= endDate)
      ),
      base44.asServiceRole.entities.Immunization.filter({}, '', 5000).then(is =>
        is.filter(i => i.created_date >= startDate && i.created_date <= endDate)
      ),
    ]);

    // Compile DHIS2-compatible aggregate data
    const opdVisits = visits.filter(v => v.visit_type === 'outpatient').length;
    const emergencyVisits = visits.filter(v => v.visit_type === 'emergency').length;
    const inpatientAdmissions = admissions.length;
    const ancVisits = maternalVisits.filter(m => m.visit_type === 'anc').length;
    const deliveries = maternalVisits.filter(m => m.visit_type === 'delivery').length;
    const postnatalVisits = maternalVisits.filter(m => m.visit_type === 'postnatal').length;
    const totalLabTests = labOrders.length;
    const liveBirths = newborns.filter(n => n.outcome === 'live_birth').length;
    const stillBirths = newborns.filter(n => n.outcome === 'stillbirth').length;
    const neonatalDeaths = newborns.filter(n => n.outcome === 'neonatal_death').length;
    const maternalDeaths = maternalVisits.filter(m => m.outcome === 'maternal_death').length;

    // Disease counts from diagnoses
    const diseaseCounts = {};
    diagnoses.forEach(d => {
      const name = d.diagnosis_name || 'Unknown';
      diseaseCounts[name] = (diseaseCounts[name] || 0) + 1;
    });

    // Immunization counts
    const immunizationCounts = {};
    immunizations.forEach(i => {
      const vax = i.vaccine_name || 'Unknown';
      immunizationCounts[vax] = (immunizationCounts[vax] || 0) + 1;
    });

    const data = {
      facility: 'Zomba City Private Clinic',
      period,
      report_type,
      generated_date: new Date().toISOString(),
      aggregates: {
        opd_visits: opdVisits,
        emergency_visits: emergencyVisits,
        inpatient_admissions: inpatientAdmissions,
        anc_first_visits: ancVisits,
        deliveries: deliveries,
        postnatal_visits: postnatalVisits,
        total_lab_tests: totalLabTests,
        live_births: liveBirths,
        still_births: stillBirths,
        neonatal_deaths: neonatalDeaths,
        maternal_deaths: maternalDeaths,
        total_visits: visits.length,
      },
      disease_counts: diseaseCounts,
      immunization_counts: immunizationCounts,
    };

    // Save to DHIS2Export entity
    const exportRecord = await base44.entities.DHIS2Export.create({
      period,
      report_type,
      data: JSON.stringify(data),
      status: 'generated',
      export_date: new Date().toISOString(),
      exported_by: user.id,
    });

    // Attempt DHIS2 submission if configured
    const dhis2Url = Deno.env.get('DHIS2_API_URL');
    const dhis2User = Deno.env.get('DHIS2_USERNAME');
    const dhis2Pass = Deno.env.get('DHIS2_PASSWORD');

    let dhis2Response = null;
    let finalStatus = 'generated';

    if (dhis2Url && dhis2User && dhis2Pass) {
      try {
        const auth = btoa(`${dhis2User}:${dhis2Pass}`);
        const res = await fetch(`${dhis2Url}/api/dataValueSets`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dataSet: report_type,
            period,
            orgUnit: 'ZOMBA_CITY_CLINIC',
            dataValues: Object.entries(data.aggregates).map(([k, v]) => ({
              dataElement: k,
              value: String(v),
            })),
          }),
        });
        dhis2Response = await res.text();
        finalStatus = res.ok ? 'submitted' : 'failed';
      } catch {
        finalStatus = 'failed';
        dhis2Response = 'DHIS2 API unreachable';
      }

      await base44.entities.DHIS2Export.update(exportRecord.id, {
        status: finalStatus,
        dhis2_response: dhis2Response,
      });
    }

    return Response.json({
      export_id: exportRecord.id,
      status: finalStatus,
      data,
      dhis2_response: dhis2Response,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});