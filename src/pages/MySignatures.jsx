import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  PenTool, Check, Clock, FileText, Pill, FlaskConical, Scan, ClipboardPen,
  AlertTriangle, ShieldCheck, Search
} from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import PageHeader from "@/components/ui/PageHeader";

const DOC_ICONS = {
  consultation: FileText, prescription: Pill, lab_order: FlaskConical,
  lab_result: FlaskConical, imaging_order: Scan, imaging_result: Scan,
  discharge_summary: ClipboardPen, clinical_note: FileText,
  prescription_dispensed: Pill,
};
const DOC_LABELS = {
  consultation: "Consultation", prescription: "Prescription",
  lab_order: "Lab Order", lab_result: "Lab Result",
  imaging_order: "Imaging Order", imaging_result: "Imaging Result",
  discharge_summary: "Discharge Summary", clinical_note: "Clinical Note",
  prescription_dispensed: "Dispensing",
};

export default function MySignatures() {
  const [tab, setTab] = useState("pending");
  const [signatures, setSignatures] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingDoc, setSigningDoc] = useState(null);
  const [savingSig, setSavingSig] = useState(false);
  const [filter, setFilter] = useState({ search: "" });

  useEffect(() => {
    async function load() {
      try {
        const [sigs, consults, rx] = await Promise.all([
          base44.entities.DigitalSignature.filter({ signed_by: "" }, "-signed_at", 200),
          base44.entities.Consultation.list("-created_date", 200),
          base44.entities.Prescription.list("-created_date", 200),
        ]);
        const mySigs = await base44.entities.DigitalSignature.filter({}, "-signed_at", 200);
        setSignatures(mySigs);
        setConsultations(consults);
        setPrescriptions(rx);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const signedDocKeys = useMemo(() => {
    const set = new Set();
    signatures.forEach(s => set.add(`${s.document_type}:${s.document_id}`));
    return set;
  }, [signatures]);

  // All "unsigned" documents (consultations + prescriptions without signatures)
  const unsignedDocs = useMemo(() => {
    const docs = [];

    consultations.forEach(c => {
      if (!signedDocKeys.has(`consultation:${c.id}`)) {
        docs.push({ type: "consultation", id: c.id, patient_id: c.patient_id,
          date: c.created_date, label: `Consultation`, summary: c.chief_complaint || c.findings || "" });
      }
    });

    prescriptions.forEach(p => {
      if (!signedDocKeys.has(`prescription:${p.id}`)) {
        docs.push({ type: "prescription", id: p.id, patient_id: p.patient_id,
          date: p.created_date, label: `Prescription`, summary: p.notes || "" });
      }
    });

    return docs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [consultations, prescriptions, signedDocKeys]);

  // Signed documents
  const signedDocs = useMemo(() => {
    return signatures.filter(s => filter.search === "" ||
      s.document_type?.toLowerCase().includes(filter.search.toLowerCase()) ||
      s.signed_by_name?.toLowerCase().includes(filter.search.toLowerCase())
    );
  }, [signatures, filter]);

  const handleSaveSignature = async (file) => {
    if (!signingDoc) return;
    setSavingSig(true);
    try {
      const { data: uploadData } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke("saveSignature", {
        file_url: uploadData.file_url,
        document_type: signingDoc.type,
        document_id: signingDoc.id,
        patient_id: signingDoc.patient_id || '',
      });
      const sigs = await base44.entities.DigitalSignature.filter({}, "-signed_at", 200);
      setSignatures(sigs);
      setSigningDoc(null);
    } catch (e) { console.error(e); }
    finally { setSavingSig(false); }
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const sigCount = signedDocs.length;
  const unsignedCount = unsignedDocs.length;

  return (
    <div className="page-container">
      <PageHeader title="My Signatures" subtitle="Sign clinical documents and track your signature compliance" icon={PenTool} className="mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-chart-3" />
          </div>
          <div><p className="text-xs text-muted-foreground">Signed</p><p className="text-xl font-bold">{sigCount}</p></div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div><p className="text-xs text-muted-foreground">Unsigned</p><p className="text-xl font-bold">{unsignedCount}</p></div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Compliance</p>
            <p className="text-xl font-bold">
              {sigCount + unsignedCount > 0 ? Math.round(sigCount / (sigCount + unsignedCount) * 100) : 100}%
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-border flex gap-1">
        {[
          { key: "pending", label: `Pending (${unsignedCount})`, icon: Clock },
          { key: "history", label: `Signatures (${sigCount})`, icon: Check },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Pending Tab */}
      {tab === "pending" && (
        <div>
          {unsignedDocs.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="w-12 h-12 text-clinical-normal mx-auto mb-3" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">All your clinical documents are signed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unsignedDocs.slice(0, 50).map(doc => {
                const Icon = DOC_ICONS[doc.type] || FileText;
                return (
                  <div key={`${doc.type}-${doc.id}`} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-xl hover:bg-destructive/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{DOC_LABELS[doc.type] || doc.type}</p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(doc.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {doc.summary && ` · ${doc.summary.slice(0, 40)}${doc.summary.length > 40 ? "..." : ""}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSigningDoc(doc)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
                    >
                      <PenTool className="w-3.5 h-3.5" /> Sign Now
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search by document type or signer..."
                value={filter.search}
                onChange={e => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
          </div>

          {signedDocs.length === 0 ? (
            <div className="py-16 text-center">
              <PenTool className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No signatures found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-card rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-xs">Document</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-xs">Signed By</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-xs">Date</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-xs w-10">Status</th>
                </tr></thead>
                <tbody>
                  {signedDocs.slice(0, 100).map(s => {
                    const Icon = DOC_ICONS[s.document_type] || FileText;
                    return (
                      <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-xs">{DOC_LABELS[s.document_type] || s.document_type}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-medium">{s.signed_by_name || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                          {new Date(s.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-chart-3/10 text-chart-3">
                            Signed
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Signature Modal */}
      {signingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSigningDoc(null)} />
          <div className="relative z-10 w-full max-w-lg mx-4">
            <SignaturePad
              title={`Sign ${DOC_LABELS[signingDoc.type] || signingDoc.type}`}
              onSave={handleSaveSignature}
              onCancel={() => setSigningDoc(null)}
              saving={savingSig}
            />
          </div>
        </div>
      )}
    </div>
  );
}