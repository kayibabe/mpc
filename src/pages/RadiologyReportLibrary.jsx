import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Scan, Search, Download, Plus, X, Save, Loader2, Eye, FileText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function RadiologyReportLibrary() {
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient_id: "",
    imaging_order_id: "",
    modality: "xray",
    body_part: "",
    findings: "",
    impression: "",
    recommendation: "",
    radiologist_name: "",
    status: "preliminary",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reportData, patientData] = await Promise.all([
        base44.entities.ImagingResult?.list?.("-created_date", 500) || [],
        base44.entities.Patient.list("-created_date", 200),
      ]);
      setReports(reportData);
      setPatients(patientData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.body_part) {
      toast({ title: "Required fields missing", description: "Please fill all required fields before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (selectedReport) {
        await base44.entities.ImagingResult.update(selectedReport.id, {
          ...form,
          report_date: new Date().toISOString(),
        });
      } else {
        await base44.entities.ImagingResult.create({
          ...form,
          report_date: new Date().toISOString(),
        });
      }
      loadData();
      setShowForm(false);
      setSelectedReport(null);
      setForm({
        patient_id: "",
        imaging_order_id: "",
        modality: "xray",
        body_part: "",
        findings: "",
        impression: "",
        recommendation: "",
        radiologist_name: "",
        status: "preliminary",
      });
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredReports = reports.filter(r => {
    const patient = patients.find(p => p.id === r.patient_id);
    const name = patient ? `${patient.first_name} ${patient.last_name}` : "";
    return name.toLowerCase().includes(searchInput.toLowerCase()) ||
      (r.body_part || "").toLowerCase().includes(searchInput.toLowerCase());
  });

  const getPatientName = (id) => {
    const p = patients.find(pt => pt.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Radiology Report Library" subtitle="Imaging reports, findings, and radiologist recommendations" icon={Scan} className="mb-6">
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedReport(null);
            setForm({
              patient_id: "",
              imaging_order_id: "",
              modality: "xray",
              body_part: "",
              findings: "",
              impression: "",
              recommendation: "",
              radiologist_name: "",
              status: "preliminary",
            });
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> New Report
        </button>
      </PageHeader>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search patient or body part..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1 rounded-lg border-none bg-transparent text-sm focus:outline-none"
        />
      </div>

      {/* Reports Grid */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No radiology reports found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Body Part</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Modality</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(report => (
                  <tr key={report.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <p className="font-medium">{getPatientName(report.patient_id)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{report.patient_id?.slice(0, 8)}</p>
                    </td>
                    <td className="py-3 px-4 capitalize">{report.body_part}</td>
                    <td className="py-3 px-4 uppercase text-xs">{report.modality}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.status === "preliminary" ? "bg-chart-4/10 text-chart-4" :
                        report.status === "final" ? "bg-chart-3/10 text-chart-3" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(report.report_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setForm(report);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary text-xs"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={report.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-chart-2/10 text-chart-2 text-xs"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <Scan className="w-5 h-5 text-primary" /> {selectedReport ? "Edit" : "New"} Radiology Report
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Patient *</label>
                  <select
                    required
                    value={form.patient_id}
                    onChange={e => setForm({ ...form, patient_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Modality</label>
                  <select
                    value={form.modality}
                    onChange={e => setForm({ ...form, modality: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="xray">X-Ray</option>
                    <option value="ct">CT Scan</option>
                    <option value="mri">MRI</option>
                    <option value="ultrasound">Ultrasound</option>
                    <option value="fluoroscopy">Fluoroscopy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Body Part *</label>
                  <input
                    required
                    type="text"
                    value={form.body_part}
                    onChange={e => setForm({ ...form, body_part: e.target.value })}
                    placeholder="e.g. Chest, Abdomen, Spine"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Radiologist</label>
                  <input
                    type="text"
                    value={form.radiologist_name}
                    onChange={e => setForm({ ...form, radiologist_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Findings</label>
                <textarea
                  value={form.findings}
                  onChange={e => setForm({ ...form, findings: e.target.value })}
                  placeholder="Detailed imaging findings..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Impression</label>
                  <textarea
                    value={form.impression}
                    onChange={e => setForm({ ...form, impression: e.target.value })}
                    placeholder="Clinical impression..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Recommendation</label>
                  <textarea
                    value={form.recommendation}
                    onChange={e => setForm({ ...form, recommendation: e.target.value })}
                    placeholder="Follow-up or clinical recommendations..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="preliminary">Preliminary</option>
                  <option value="final">Final</option>
                  <option value="amended">Amended</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}