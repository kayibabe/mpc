import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Baby, Plus, Save, Heart, Calendar } from "lucide-react";

export default function Maternal() {
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient_id: "", lmp: "", anc_visit_number: "1", gravida: "", para: "",
    gestational_age_weeks: "", fundal_height: "", fetal_heart_rate: "",
    fetal_presentation: "", iron_folate_given: false, tt_vaccine_given: false,
    iptp_given: false, malaria_test_result: "", hiv_status: "", blood_pressure: "",
    urine_protein: "", weight: "", notes: "",
  });
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [partograph, setPartograph] = useState([]);
  const [partoForm, setPartoForm] = useState({
    cervical_dilation_cm: "", descent: "", contractions_per_10min: "",
    contraction_duration_sec: "", fetal_heart_rate: "", amniotic_fluid: "intact",
    moulding: "none", oxytocin_dose: "", bp_systolic: "", bp_diastolic: "",
    pulse: "", temperature: "", urine_volume: "",
  });
  const [newborns, setNewborns] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [m, p] = await Promise.all([
          base44.entities.MaternalVisit.list("-created_date", 100),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setVisits(m);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => { const p = patients.find(pt => pt.id === pid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const calculateEDD = (lmp) => {
    if (!lmp) return "";
    const d = new Date(lmp);
    d.setDate(d.getDate() + 280);
    return d.toISOString().split("T")[0];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.MaternalVisit.create({
      ...form, edd: calculateEDD(form.lmp), visit_date: new Date().toISOString(),
      gravida: Number(form.gravida) || 0, para: Number(form.para) || 0,
      gestational_age_weeks: Number(form.gestational_age_weeks) || 0,
      fundal_height: Number(form.fundal_height) || 0,
      fetal_heart_rate: Number(form.fetal_heart_rate) || 0,
      weight: Number(form.weight) || 0,
    });
    const m = await base44.entities.MaternalVisit.list("-created_date", 100);
    setVisits(m);
    setShowForm(false);
  };

  const selectVisit = async (visit) => {
    setSelectedVisit(visit);
    const [p, n] = await Promise.all([
      base44.entities.PartographEntry.filter({ maternal_visit_id: visit.id }, "entry_time", 50),
      base44.entities.NewbornRecord.filter({ maternal_visit_id: visit.id }, "-created_date", 10),
    ]);
    setPartograph(p);
    setNewborns(n);
  };

  const addPartographEntry = async () => {
    if (!selectedVisit || !partoForm.cervical_dilation_cm) return;
    await base44.entities.PartographEntry.create({
      maternal_visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
      entry_time: new Date().toISOString(),
      cervical_dilation_cm: Number(partoForm.cervical_dilation_cm),
      descent: Number(partoForm.descent) || 0,
      contractions_per_10min: Number(partoForm.contractions_per_10min) || 0,
      contraction_duration_sec: Number(partoForm.contraction_duration_sec) || 0,
      fetal_heart_rate: Number(partoForm.fetal_heart_rate) || 0,
      oxytocin_dose: Number(partoForm.oxytocin_dose) || 0,
      bp_systolic: Number(partoForm.bp_systolic) || 0,
      bp_diastolic: Number(partoForm.bp_diastolic) || 0,
      pulse: Number(partoForm.pulse) || 0,
      temperature: Number(partoForm.temperature) || 0,
      urine_volume: Number(partoForm.urine_volume) || 0,
      amniotic_fluid: partoForm.amniotic_fluid,
      moulding: partoForm.moulding,
    });
    const p = await base44.entities.PartographEntry.filter({ maternal_visit_id: selectedVisit.id }, "entry_time", 50);
    setPartograph(p);
  };

  const addNewborn = async () => {
    if (!selectedVisit) return;
    const name = prompt("Baby name:");
    const gender = prompt("Gender (male/female):");
    const weight = prompt("Birth weight (kg):");
    if (!name || !gender || !weight) return;
    await base44.entities.NewbornRecord.create({
      maternal_visit_id: selectedVisit.id, mother_id: selectedVisit.patient_id,
      baby_name: name, gender, birth_weight_kg: Number(weight),
      birth_date: new Date().toISOString(), delivery_type: "normal_vaginal",
      apgar_1min: Number(prompt("APGAR 1 min:")) || 0,
      apgar_5min: Number(prompt("APGAR 5 min:")) || 0,
    });
    const n = await base44.entities.NewbornRecord.filter({ maternal_visit_id: selectedVisit.id }, "-created_date", 10);
    setNewborns(n);
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const amnioticLabels = { intact: "Intact", clear: "Clear", meconium: "Meconium", blood_stained: "Blood Stained", absent: "Absent" };
  const mouldingLabels = { none: "None", "+": "+", "++": "++", "+++": "+++" };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="section-title">Maternal Health</h2><p className="text-sm text-muted-foreground mt-1">ANC visits, partograph, labour monitoring, and newborn records</p></div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shadow-sm"><Plus className="w-4 h-4" /> New ANC Visit</button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-sm mb-6">
          <h3 className="font-heading text-lg font-semibold mb-4">New ANC Visit</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label><select required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})}><option value="">Select</option>{patients.filter(p => p.gender === "female").map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">LMP *</label><input type="date" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.lmp} onChange={e => setForm({...form, lmp: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">EDD</label><input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm bg-muted/50" value={calculateEDD(form.lmp)} readOnly /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">ANC Visit #</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.anc_visit_number} onChange={e => setForm({...form, anc_visit_number: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Gravida</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.gravida} onChange={e => setForm({...form, gravida: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Para</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.para} onChange={e => setForm({...form, para: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Gestational Age (weeks)</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.gestational_age_weeks} onChange={e => setForm({...form, gestational_age_weeks: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Fundal Height (cm)</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.fundal_height} onChange={e => setForm({...form, fundal_height: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Fetal Heart Rate</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.fetal_heart_rate} onChange={e => setForm({...form, fetal_heart_rate: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Fetal Presentation</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.fetal_presentation} onChange={e => setForm({...form, fetal_presentation: e.target.value})} placeholder="e.g. Cephalic, Breech" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Blood Pressure</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.blood_pressure} onChange={e => setForm({...form, blood_pressure: e.target.value})} placeholder="e.g. 120/80" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Weight (kg)</label><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">HIV Status</label><select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.hiv_status} onChange={e => setForm({...form, hiv_status: e.target.value})}><option value="">Unknown</option><option value="negative">Negative</option><option value="positive">Positive</option></select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Malaria Test</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.malaria_test_result} onChange={e => setForm({...form, malaria_test_result: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Urine Protein</label><input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={form.urine_protein} onChange={e => setForm({...form, urine_protein: e.target.value})} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              {["iron_folate_given", "tt_vaccine_given", "iptp_given"].map(key => (
                <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key]} onChange={e => setForm({...form, [key]: e.target.checked})} className="rounded border-border" /> <span className="capitalize">{key.replace(/_/g, " ")}</span></label>
              ))}
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label><textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="flex gap-3"><button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Save className="w-3 h-3 inline mr-1" /> Save Visit</button><button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl border border-border/60 shadow-sm">
          <div className="p-4 border-b border-border"><h3 className="font-heading font-semibold">ANC Visits</h3></div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {visits.map(v => (
              <button key={v.id} onClick={() => selectVisit(v)} className={`w-full text-left p-3 hover:bg-muted/40 ${selectedVisit?.id === v.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}>
                <p className="text-sm font-medium">{getPatientName(v.patient_id)}</p>
                <p className="text-xs text-muted-foreground">ANC #{v.anc_visit_number} • {v.gestational_age_weeks}w • {new Date(v.visit_date).toLocaleDateString("en-GB")}</p>
              </button>
            ))}
            {visits.length === 0 && <p className="p-4 text-sm text-muted-foreground">No ANC visits.</p>}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selectedVisit ? (
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-12 text-center"><Baby className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-muted-foreground">Select an ANC visit to view details.</p></div>
          ) : (
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
                <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> Partograph — Labour Monitoring</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[{label: "Cervical Dilation (cm)", key: "cervical_dilation_cm"}, {label: "Descent", key: "descent"}, {label: "Contractions/10min", key: "contractions_per_10min"}, {label: "Duration (sec)", key: "contraction_duration_sec"}, {label: "FHR", key: "fetal_heart_rate"}, {label: "Oxytocin (mL/h)", key: "oxytocin_dose"}, {label: "BP Systolic", key: "bp_systolic"}, {label: "BP Diastolic", key: "bp_diastolic"}, {label: "Pulse", key: "pulse"}, {label: "Temp (°C)", key: "temperature"}, {label: "Urine (mL)", key: "urine_volume"}].map(f => (
                    <div key={f.key}><label className="block text-xs text-muted-foreground mb-0.5">{f.label}</label><input type="number" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" value={partoForm[f.key]} onChange={e => setPartoForm({...partoForm, [f.key]: e.target.value})} /></div>
                  ))}
                </div>
                <div className="flex gap-2 mb-3">
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Amniotic Fluid</label><select className="rounded border border-border bg-background px-2 py-1 text-xs" value={partoForm.amniotic_fluid} onChange={e => setPartoForm({...partoForm, amniotic_fluid: e.target.value})}>{Object.entries(amnioticLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><label className="block text-xs text-muted-foreground mb-0.5">Moulding</label><select className="rounded border border-border bg-background px-2 py-1 text-xs" value={partoForm.moulding} onChange={e => setPartoForm({...partoForm, moulding: e.target.value})}>{Object.entries(mouldingLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addPartographEntry} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium"><Plus className="w-3 h-3 inline mr-1" /> Add Entry</button>
                  <button onClick={addNewborn} className="px-3 py-1.5 bg-chart-2 text-white rounded text-xs font-medium"><Baby className="w-3 h-3 inline mr-1" /> Record Newborn</button>
                </div>
                {partograph.length > 0 && (
                  <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border"><th className="text-left py-1 px-2">Time</th><th className="text-left py-1 px-2">Dilation</th><th className="text-left py-1 px-2">Contractions</th><th className="text-left py-1 px-2">FHR</th><th className="text-left py-1 px-2">Fluid</th><th className="text-left py-1 px-2">Moulding</th></tr></thead><tbody>{partograph.map(p => (<tr key={p.id} className="border-b border-border/40"><td className="py-1 px-2">{new Date(p.entry_time).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"})}</td><td className="py-1 px-2">{p.cervical_dilation_cm}cm</td><td className="py-1 px-2">{p.contractions_per_10min}/10</td><td className="py-1 px-2">{p.fetal_heart_rate}</td><td className="py-1 px-2">{p.amniotic_fluid}</td><td className="py-1 px-2">{p.moulding}</td></tr>))}</tbody></table></div>
                )}
              </div>

              {newborns.length > 0 && (
                <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5">
                  <h4 className="font-heading font-semibold mb-3">Newborn Records</h4>
                  {newborns.map(n => (
                    <div key={n.id} className="p-3 bg-muted/30 rounded-lg mb-2">
                      <p className="font-medium text-sm">{n.baby_name} — {n.gender}, {n.birth_weight_kg}kg</p>
                      <p className="text-xs text-muted-foreground">APGAR: {n.apgar_1min}/{n.apgar_5min} • {n.delivery_type} • {new Date(n.birth_date).toLocaleString("en-GB")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}