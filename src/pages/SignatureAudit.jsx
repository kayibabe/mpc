import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  PenTool, Search, Filter, Calendar, FileText, Pill, FlaskConical,
  Scan, ClipboardPen, Clock, User, ChevronDown, Download, X
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const DOC_TYPE_ICONS = {
  consultation: FileText,
  prescription: Pill,
  lab_order: FlaskConical,
  lab_result: FlaskConical,
  imaging_order: Scan,
  imaging_result: Scan,
  discharge_summary: ClipboardPen,
  clinical_note: FileText,
  prescription_dispensed: Pill,
};

const DOC_TYPE_LABELS = {
  consultation: "Consultation",
  prescription: "Prescription",
  lab_order: "Lab Order",
  lab_result: "Lab Result",
  imaging_order: "Imaging Order",
  imaging_result: "Imaging Result",
  discharge_summary: "Discharge Summary",
  clinical_note: "Clinical Note",
  prescription_dispensed: "Dispensing",
};

const DOC_TYPE_COLORS = {
  consultation: "bg-primary/10 text-primary",
  prescription: "bg-chart-2/10 text-chart-2",
  lab_order: "bg-chart-3/10 text-chart-3",
  lab_result: "bg-chart-3/10 text-chart-3",
  imaging_order: "bg-chart-4/10 text-chart-4",
  imaging_result: "bg-chart-4/10 text-chart-4",
  discharge_summary: "bg-chart-1/10 text-chart-1",
  clinical_note: "bg-muted text-muted-foreground",
  prescription_dispensed: "bg-chart-2/10 text-chart-2",
};

export default function SignatureAudit() {
  const [signatures, setSignatures] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: "", dateFrom: "", dateTo: "", search: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSig, setSelectedSig] = useState(null);
  const [sigImageUrl, setSigImageUrl] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [sigs, logs, pats] = await Promise.all([
          base44.entities.DigitalSignature.list("-signed_at", 200),
          base44.entities.AuditLog.list("-timestamp", 200),
          base44.entities.Patient.list("-created_date", 200),
        ]);
        setSignatures(sigs);
        setAuditLogs(logs);
        setPatients(pats);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : pid?.slice(0, 8) || "—";
  };

  const filteredSignatures = useMemo(() => {
    return signatures.filter(s => {
      if (filter.type && s.document_type !== filter.type) return false;
      if (filter.dateFrom && new Date(s.signed_at) < new Date(filter.dateFrom)) return false;
      if (filter.dateTo && new Date(s.signed_at) > new Date(filter.dateTo + "T23:59:59")) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const pName = getPatientName(s.patient_id).toLowerCase();
        const docId = s.document_id?.toLowerCase() || "";
        const signedBy = s.signed_by_name?.toLowerCase() || "";
        if (!pName.includes(q) && !docId.includes(q) && !signedBy.includes(q)) return false;
      }
      return true;
    });
  }, [signatures, filter]);

  // Related audit logs for selected signature
  const relatedLogs = useMemo(() => {
    if (!selectedSig) return [];
    return auditLogs.filter(l =>
      l.entity_type === "DigitalSignature" && l.entity_id === selectedSig.id
    );
  }, [selectedSig, auditLogs]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const signedToday = signatures.filter(s => s.signed_at?.startsWith(today)).length;
    const byType = {};
    signatures.forEach(s => {
      byType[s.document_type] = (byType[s.document_type] || 0) + 1;
    });
    const topSigners = {};
    signatures.forEach(s => {
      const name = s.signed_by_name || "Unknown";
      topSigners[name] = (topSigners[name] || 0) + 1;
    });
    const sortedSigners = Object.entries(topSigners).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { signedToday, byType, topSigners: sortedSigners, total: signatures.length };
  }, [signatures]);

  const openSigImage = async (sig) => {
    setSelectedSig(sig);
    if (sig.signature_url) {
      try {
        const { data } = await base44.integrations.Core.CreateFileSignedUrl({
          file_uri: sig.signature_url,
          expires_in: 300,
        });
        setSigImageUrl(data.signed_url);
      } catch (e) {
        setSigImageUrl(null);
      }
    } else {
      setSigImageUrl(null);
    }
  };

  const clearFilters = () => setFilter({ type: "", dateFrom: "", dateTo: "", search: "" });
  const hasActiveFilters = filter.type || filter.dateFrom || filter.dateTo || filter.search;

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Signature Audit" subtitle="Track and verify all clinical signatures with full audit trail" icon={PenTool} className="mb-6" />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Signatures</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-chart-3" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Signed Today</p>
            <p className="text-xl font-bold">{stats.signedToday}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-chart-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Document Types</p>
            <p className="text-xl font-bold">{Object.keys(stats.byType).length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-chart-1/10 flex items-center justify-center">
            <User className="w-5 h-5 text-chart-1" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Signers</p>
            <p className="text-xl font-bold">{stats.topSigners.length}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm mb-6">
        <div className="p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by patient, signer, or document ID..."
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
              showFilters || hasActiveFilters ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="px-2 py-2 rounded-lg text-destructive hover:bg-destructive/5 text-sm">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {showFilters && (
          <div className="px-4 pb-4 flex flex-wrap gap-3 border-t border-border pt-3">
            <select
              value={filter.type}
              onChange={e => setFilter({ ...filter, type: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Document Types</option>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={filter.dateFrom}
                onChange={e => setFilter({ ...filter, dateFrom: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="From"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={filter.dateTo}
                onChange={e => setFilter({ ...filter, dateTo: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="To"
              />
            </div>
          </div>
        )}
      </div>

      {/* Signatures Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Document</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Patient</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Signed By</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Title</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date & Time</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-10">Sig</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignatures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    {hasActiveFilters ? "No signatures match your filters." : "No signatures recorded yet."}
                  </td>
                </tr>
              ) : (
                filteredSignatures.map(s => {
                  const Icon = DOC_TYPE_ICONS[s.document_type] || FileText;
                  const colorClasses = DOC_TYPE_COLORS[s.document_type] || "bg-muted text-muted-foreground";
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => openSigImage(s)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClasses}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-medium block">
                              {DOC_TYPE_LABELS[s.document_type] || s.document_type}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {s.document_id?.slice(0, 12)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{getPatientName(s.patient_id)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{s.signed_by_name || "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-muted-foreground">{s.signed_by_title || "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-xs">
                            {new Date(s.signed_at).toLocaleString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {s.signature_url ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-chart-3/10 text-chart-3">
                            ✓ Signed
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          Showing {filteredSignatures.length} of {signatures.length} signatures
          {hasActiveFilters && " (filtered)"}
        </div>
      </div>

      {/* Top Signers Panel */}
      {stats.topSigners.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border/60 shadow-sm p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Top Signers
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.topSigners.map(([name, count], i) => (
              <div key={name} className="bg-muted/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{count}</p>
                <p className="text-xs text-muted-foreground truncate">{name}</p>
                {i === 0 && <span className="text-[10px] text-chart-2 font-semibold">Most Active</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature Detail Modal */}
      {selectedSig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedSig(null); setSigImageUrl(null); }} />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-lg">Signature Detail</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {selectedSig.id}</p>
              </div>
              <button
                onClick={() => { setSelectedSig(null); setSigImageUrl(null); }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Document Type</p>
                  <p className="text-sm font-semibold">{DOC_TYPE_LABELS[selectedSig.document_type] || selectedSig.document_type}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Document ID</p>
                  <p className="text-sm font-mono">{selectedSig.document_id?.slice(0, 16)}...</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Patient</p>
                  <p className="text-sm font-semibold">{getPatientName(selectedSig.patient_id)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Visit</p>
                  <p className="text-sm font-mono">{selectedSig.visit_id?.slice(0, 12) || "—"}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Signed By</p>
                  <p className="text-sm font-semibold">{selectedSig.signed_by_name || "—"}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Title</p>
                  <p className="text-sm">{selectedSig.signed_by_title || "—"}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Signed At</p>
                  <p className="text-sm font-mono">
                    {new Date(selectedSig.signed_at).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">IP Address</p>
                  <p className="text-sm font-mono">{selectedSig.ip_address || "—"}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedSig.notes && (
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedSig.notes}</p>
                </div>
              )}

              {/* Signature Image */}
              {sigImageUrl ? (
                <div className="bg-muted/10 rounded-xl border border-border p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Digital Signature</p>
                  <img
                    src={sigImageUrl}
                    alt="Digital signature"
                    className="max-h-28 bg-white rounded-lg border border-border p-2"
                  />
                </div>
              ) : selectedSig.signature_url ? (
                <div className="bg-muted/10 rounded-xl border border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Loading signature image...</p>
                </div>
              ) : null}

              {/* Audit Trail */}
              <div className="border-t border-border pt-4">
                <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Audit Trail
                </h4>
                {relatedLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-lg">
                    No audit log entries for this signature.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relatedLogs.map(log => (
                      <div key={log.id} className="bg-muted/10 rounded-lg p-3 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{log.action}</span>
                          <span className="text-muted-foreground font-mono">
                            {new Date(log.timestamp).toLocaleString("en-GB", {
                              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          User: {log.user_id?.slice(0, 12)}...
                          {log.changes && <span className="block mt-0.5 text-[10px]">Changes: {log.changes}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => { setSelectedSig(null); setSigImageUrl(null); }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}