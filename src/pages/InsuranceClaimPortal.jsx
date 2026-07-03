import { useState, useEffect } from "react";
import InsuranceClaimFormBuilder from "@/components/InsuranceClaimFormBuilder";
import { base44 } from "@/api/base44Client";
import {
  FileText, Plus, Search, Download, Clock, X, Save, Loader2, RefreshCw, Edit3
} from "lucide-react";
import DigitalClaimFormBuilder from "@/components/DigitalClaimFormBuilder";
import ClaimStatusTracker from "@/components/ClaimStatusTracker";
import ClaimsDashboard from "@/components/ClaimsDashboard";
import ClaimsCalendar from "@/components/ClaimsCalendar";
import ClaimRejectionTracker from "@/components/ClaimRejectionTracker";
import ClaimApprovalWorkflow from "@/components/ClaimApprovalWorkflow";
import ClaimSummaryDashboard from "@/components/ClaimSummaryDashboard";
import ClaimPreviewModal from "@/components/ClaimPreviewModal";
import { validateClaim } from "@/lib/claimValidation";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_COLORS = {
  pending: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  submitted: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  approved: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  partial: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  paid: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

export default function InsuranceClaimPortal() {
  const [claims, setClaims] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("list");

  const [form, setForm] = useState({
    invoice_id: "",
    patient_id: "",
    scheme_id: "",
    scheme_name: "",
    claim_amount: "",
    co_pay_amount: "0",
  });
  const [exportingClaimId, setExportingClaimId] = useState(null);
  const [showDigitalForm, setShowDigitalForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedForBatch, setSelectedForBatch] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [previewClaimId, setPreviewClaimId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [claimData, invoiceData, patientData, schemeData] = await Promise.all([
        base44.entities.InsuranceClaim.list("-created_date", 100),
        base44.entities.Invoice.list("-created_date", 200),
        base44.entities.Patient.list("-created_date", 200),
        base44.entities.MedicalAidScheme.list("", 100),
      ]);
      setClaims(claimData);
      setInvoices(invoiceData);
      setPatients(patientData);
      setSchemes(schemeData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = claims
    .filter(c => filterStatus === "all" || c.status === filterStatus)
    .filter(c => {
      const patient = patients.find(p => p.id === c.patient_id);
      const invoice = invoices.find(i => i.id === c.invoice_id);
      const name = patient ? `${patient.first_name} ${patient.last_name}` : "";
      const invNum = invoice?.invoice_number || "";
      return name.toLowerCase().includes(searchInput.toLowerCase()) || invNum.toLowerCase().includes(searchInput.toLowerCase());
    });

  const handleSaveClaim = async (e) => {
    e.preventDefault();
    
    const validation = validateClaim(form, patients, invoices);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (validation.warnings.length > 0) {
      const proceed = confirm("Warnings:\n\n" + validation.warnings.join("\n") + "\n\nContinue anyway?");
      if (!proceed) return;
    }

    setSaving(true);
    setValidationErrors([]);
    try {
      await base44.entities.InsuranceClaim.create({
        ...form,
        claim_amount: Number(form.claim_amount),
        co_pay_amount: Number(form.co_pay_amount) || 0,
        status: "pending",
        submitted_date: null,
      });
      loadData();
      setShowForm(false);
      setForm({
        invoice_id: "",
        patient_id: "",
        scheme_id: "",
        scheme_name: "",
        claim_amount: "",
        co_pay_amount: "0",
      });
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitClaim = async (claimId) => {
    try {
      await base44.entities.InsuranceClaim.update(claimId, {
        status: "submitted",
        submitted_date: new Date().toISOString(),
      });
      loadData();
    } catch (e) {
      alert("Submit failed: " + e.message);
    }
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === "submitted" && !claims.find(c => c.id === claimId).submitted_date) {
        updateData.submitted_date = new Date().toISOString();
      }
      await base44.entities.InsuranceClaim.update(claimId, updateData);
      loadData();
    } catch (e) {
      alert("Update failed: " + e.message);
    }
  };

  const getPatientName = (id) => {
    const p = patients.find(pt => pt.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const getInvoiceNumber = (id) => {
    const i = invoices.find(inv => inv.id === id);
    return i?.invoice_number || id?.slice(0, 8);
  };

  const exportClaimForm = async (claim) => {
    const validation = validateClaim(claim, patients, invoices);
    if (!validation.valid) {
      alert("Cannot export:\n\n" + validation.errors.join("\n"));
      return;
    }

    // Validate scheme exists
    const scheme = schemes.find(s => s.id === claim.scheme_id);
    if (!scheme) {
      alert("Insurance scheme is invalid or was deleted. Please update the claim with a valid scheme.");
      return;
    }

    setExportingClaimId(claim.id);
    try {
      const { data } = await base44.functions.invoke('exportClaimFormPdf', {
        invoice_id: claim.invoice_id,
        patient_id: claim.patient_id,
        scheme_id: claim.scheme_id,
        claim_amount: claim.claim_amount
      });
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdf_base64}`;
      link.download = data.filename || `claim_${claim.id.slice(0, 8)}.pdf`;
      link.click();
    } catch (e) {
      alert("Export failed: " + (e.response?.data?.error || e.message));
    } finally {
      setExportingClaimId(null);
    }
  };

  const syncSelectedToDrive = async () => {
    setBatchSyncing(true);
    try {
      for (const claimId of selectedForBatch) {
        await base44.functions.invoke('syncClaimsToDrive', { claim_id: claimId });
      }
      alert(`✅ Synced ${selectedForBatch.length} claim(s) to Google Drive`);
      setSelectedForBatch([]);
    } catch (e) {
      alert("Sync failed: " + e.message);
    } finally {
      setBatchSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const statusCounts = {
    all: claims.length,
    pending: claims.filter(c => c.status === "pending").length,
    submitted: claims.filter(c => c.status === "submitted").length,
    approved: claims.filter(c => c.status === "approved").length,
    partial: claims.filter(c => c.status === "partial").length,
    rejected: claims.filter(c => c.status === "rejected").length,
    paid: claims.filter(c => c.status === "paid").length,
  };

  return (
    <div className="page-container">
      <PageHeader title="Insurance Claims Portal" subtitle="Manage insurance billing and claim submissions" icon={FileText} className="mb-6">
        <button
          onClick={() => setShowDigitalForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-chart-1 text-white rounded-lg text-sm font-medium hover:bg-chart-1/90"
        >
          <Edit3 className="w-4 h-4" /> Digital Form
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </PageHeader>

      {/* Tabs */}
      <div className="mb-6 border-b border-border flex gap-4 overflow-x-auto">
        {[
          { id: "forms", label: "Digital Forms" },
          { id: "summary", label: "Summary" },
          { id: "list", label: "Claims List" },
          { id: "approval", label: "Approval Workflow" },
          { id: "rejections", label: "Rejections" },
          { id: "dashboard", label: "Analytics" },
          { id: "calendar", label: "Calendar" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Insurance Claims Tracker (always visible) */}
      <div className="mb-6">
        <ClaimStatusTracker />
      </div>

      {/* Tab Content - Digital Forms */}
      {activeTab === "forms" && <InsuranceClaimFormBuilder />}

      {/* Tab Content - Summary */}
      {activeTab === "summary" && <ClaimSummaryDashboard />}

      {/* Tab Content - Approval Workflow */}
      {activeTab === "approval" && <ClaimApprovalWorkflow />}

      {/* Tab Content - Rejections */}
      {activeTab === "rejections" && <ClaimRejectionTracker />}

      {/* Tab Content - Analytics Dashboard */}
      {activeTab === "dashboard" && <ClaimsDashboard />}

      {/* Tab Content - Calendar */}
      {activeTab === "calendar" && <ClaimsCalendar />}

      {/* Tab Content - Claims List */}
      {activeTab === "list" && (
        <>
      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {[
          { status: "all", label: "All" },
          { status: "pending", label: "Pending" },
          { status: "submitted", label: "Submitted" },
          { status: "approved", label: "Approved" },
          { status: "partial", label: "Partial" },
          { status: "rejected", label: "Rejected" },
          { status: "paid", label: "Paid" },
        ].map(s => (
          <button
            key={s.status}
            onClick={() => setFilterStatus(s.status)}
            className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
              filterStatus === s.status
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border hover:bg-muted/80"
            }`}
          >
            <div className="text-xs font-semibold">{statusCounts[s.status]}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patient or invoice..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Batch Actions */}
      {selectedForBatch.length > 0 && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium">{selectedForBatch.length} claim(s) selected</span>
          <div className="flex gap-2">
            <button
              onClick={syncSelectedToDrive}
              disabled={batchSyncing}
              className="px-3 py-1.5 bg-chart-2/10 text-chart-2 rounded-lg text-xs font-medium hover:bg-chart-2/20 disabled:opacity-50 flex items-center gap-1"
            >
              {batchSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {batchSyncing ? "Syncing..." : "Sync to Drive"}
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  for (const id of selectedForBatch) {
                    await base44.entities.InsuranceClaim.update(id, {
                      status: "submitted",
                      submitted_date: new Date().toISOString()
                    });
                  }
                  setSelectedForBatch([]);
                  loadData();
                } catch (e) {
                  alert("Batch submit failed: " + e.message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
            >
              Submit Selected
            </button>
            <button
              onClick={async () => {
                const csv = [
                  "Claim ID,Invoice,Patient,Scheme,Amount,Status,Submitted",
                  ...selectedForBatch.map(id => {
                    const c = claims.find(x => x.id === id);
                    return `${c.id.slice(0, 8)},${c.invoice_id?.slice(0, 8) || "N/A"},${c.patient_id?.slice(0, 8) || "N/A"},${c.scheme_name},${c.claim_amount},${c.status},${c.submitted_date ? new Date(c.submitted_date).toLocaleDateString() : "N/A"}`;
                  })
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `claims_batch_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 bg-chart-3/10 text-chart-3 rounded-lg text-xs font-medium hover:bg-chart-3/20"
            >
              Export CSV
            </button>
            <button
              onClick={() => setSelectedForBatch([])}
              className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Claims Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {filteredClaims.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No claims found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedForBatch.length === filteredClaims.length && filteredClaims.length > 0}
                      onChange={() => {
                        if (selectedForBatch.length === filteredClaims.length) {
                          setSelectedForBatch([]);
                        } else {
                          setSelectedForBatch(filteredClaims.map(c => c.id));
                        }
                      }}
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Scheme</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claim Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Submitted</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map(claim => (
                  <tr key={claim.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="text-center py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedForBatch.includes(claim.id)}
                        onChange={() => {
                          if (selectedForBatch.includes(claim.id)) {
                            setSelectedForBatch(selectedForBatch.filter(id => id !== claim.id));
                          } else {
                            setSelectedForBatch([...selectedForBatch, claim.id]);
                          }
                        }}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-sm">{getPatientName(claim.patient_id)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{claim.patient_id?.slice(0, 8)}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{getInvoiceNumber(claim.invoice_id)}</td>
                    <td className="py-3 px-4 text-sm">{claim.scheme_name}</td>
                    <td className="py-3 px-4 font-medium">MWK {(claim.claim_amount || 0).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-block capitalize ${STATUS_COLORS[claim.status] || ""}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {claim.submitted_date ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(claim.submitted_date).toLocaleDateString("en-GB")}
                        </span>
                      ) : (
                        <span className="text-xs text-destructive">Not submitted</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {claim.status === "pending" && (
                          <button
                            onClick={() => submitClaim(claim.id)}
                            className="px-2 py-1 bg-chart-1/10 text-chart-1 rounded text-xs hover:bg-chart-1/20"
                          >
                            Submit
                          </button>
                        )}
                        <button
                          onClick={() => setPreviewClaimId(claim.id)}
                          className="px-2 py-1 bg-chart-3/10 text-chart-3 rounded text-xs hover:bg-chart-3/20"
                          title="Preview & validate before export"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => setShowDetails(claim.id)}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claim Preview Modal */}
      {previewClaimId && (
        <ClaimPreviewModal
          claim={claims.find(c => c.id === previewClaimId)}
          patients={patients}
          invoices={invoices}
          schemes={schemes}
          onClose={() => setPreviewClaimId(null)}
          onExport={async () => {
            const claimToExport = claims.find(c => c.id === previewClaimId);
            await exportClaimForm(claimToExport);
            setPreviewClaimId(null);
          }}
        />
      )}

      {/* Claim Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDetails(null)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            {(() => {
              const claim = claims.find(c => c.id === showDetails);
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Claim Details
                    </h3>
                    <button onClick={() => setShowDetails(null)} className="p-1 rounded hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Patient</p>
                        <p className="text-sm font-semibold mt-1">{getPatientName(claim.patient_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Invoice</p>
                        <p className="text-sm font-semibold mt-1">{getInvoiceNumber(claim.invoice_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Scheme</p>
                        <p className="text-sm font-semibold mt-1">{claim.scheme_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Status</p>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize mt-1 ${STATUS_COLORS[claim.status] || ""}`}>
                          {claim.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Claim Amount</p>
                        <p className="text-sm font-semibold mt-1 font-mono">MWK {(claim.claim_amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Co-pay</p>
                        <p className="text-sm font-semibold mt-1 font-mono">MWK {(claim.co_pay_amount || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    {claim.submitted_date && (
                      <div className="p-3 bg-muted/30 rounded-lg text-xs">
                        <p className="text-muted-foreground">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Submitted: {new Date(claim.submitted_date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    )}

                    {claim.response_notes && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Response Notes</p>
                        <p className="text-xs text-foreground">{claim.response_notes}</p>
                      </div>
                    )}

                    {claim.response_date && (
                      <div className="text-xs text-muted-foreground">
                        Response received: {new Date(claim.response_date).toLocaleDateString("en-GB")}
                      </div>
                    )}

                    {/* Status Update Controls */}
                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Update Status</p>
                      <div className="flex gap-2 flex-wrap">
                        {["pending", "submitted", "approved", "partial", "rejected", "paid"].map(status => (
                          <button
                            key={status}
                            onClick={() => updateClaimStatus(claim.id, status)}
                            disabled={claim.status === status}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all capitalize ${
                              claim.status === status
                                ? "bg-muted border-border text-muted-foreground cursor-default"
                                : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Export Claim Form */}
                    <div className="border-t border-border pt-4">
                      <button
                        onClick={() => {
                          setShowDetails(null);
                          setPreviewClaimId(claim.id);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-chart-3/10 text-chart-3 rounded-lg text-sm font-medium hover:bg-chart-3/20 border border-chart-3/20"
                      >
                        <Download className="w-4 h-4" />
                        Export Claim Form (PDF)
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* New Claim Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Create Insurance Claim
              </h3>
              <button onClick={() => { setShowForm(false); setValidationErrors([]); }} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <p className="text-xs font-semibold text-destructive mb-1">Validation Errors:</p>
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">• {err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveClaim} className="space-y-4">
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
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.mrn})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Invoice *</label>
                <select
                  required
                  value={form.invoice_id}
                  onChange={e => {
                    const inv = invoices.find(i => i.id === e.target.value);
                    setForm({ ...form, invoice_id: e.target.value, claim_amount: inv?.total_amount || "" });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select invoice</option>
                  {invoices.map(i => (
                    <option key={i.id} value={i.id}>{i.invoice_number} - MWK {(i.total_amount || 0).toLocaleString()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Insurance Scheme *</label>
                <select
                  required
                  value={form.scheme_id}
                  onChange={e => {
                    const scheme = schemes.find(s => s.id === e.target.value);
                    setForm({ ...form, scheme_id: e.target.value, scheme_name: scheme?.name || "" });
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select scheme</option>
                  {schemes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Claim Amount *</label>
                  <input
                    required
                    type="number"
                    value={form.claim_amount}
                    onChange={e => setForm({ ...form, claim_amount: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Co-pay Amount</label>
                  <input
                    type="number"
                    value={form.co_pay_amount}
                    onChange={e => setForm({ ...form, co_pay_amount: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Creating..." : "Create Claim"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setValidationErrors([]); }} className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Claim Form Modal */}
      {showDigitalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDigitalForm(false)} />
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-3xl mx-4 my-8">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card rounded-t-xl">
              <h3 className="font-heading text-lg font-semibold">Create Digital Insurance Claim</h3>
              <button onClick={() => setShowDigitalForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(100vh-150px)] overflow-y-auto">
              {!selectedInvoice ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">Select an invoice to create a digital claim form:</p>
                  <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                    {invoices.map(inv => {
                      const patient = patients.find(p => p.id === inv.patient_id);
                      return (
                        <button
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{patient ? `${patient.first_name} ${patient.last_name}` : "Unknown"}</p>
                              <p className="text-xs text-muted-foreground mt-1">Invoice: {inv.invoice_number || inv.id.slice(0, 8)}</p>
                              <p className="text-xs text-muted-foreground">Status: {inv.status}</p>
                            </div>
                            <span className="font-bold text-primary">MWK {(inv.total_amount || 0).toLocaleString()}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <DigitalClaimFormBuilder
                  invoice={selectedInvoice}
                  onClose={() => {
                    setSelectedInvoice(null);
                    setShowDigitalForm(false);
                  }}
                  onSave={() => {
                    setSelectedInvoice(null);
                    setShowDigitalForm(false);
                    loadData();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}