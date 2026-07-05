import { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Download, Loader2 } from "lucide-react";

const VALIDATION_RULES = [
  { id: 'scheme', label: 'Valid Insurance Scheme', check: (claim, schemes) => schemes.some(s => s.id === claim.scheme_id) },
  { id: 'amount', label: 'Claim Amount > 0', check: (claim) => Number(claim.claim_amount) > 0 },
  { id: 'patient', label: 'Patient Assigned', check: (claim) => !!claim.patient_id },
  { id: 'invoice', label: 'Invoice Linked', check: (claim) => !!claim.invoice_id },
  { id: 'copayvali', label: 'Co-pay < Claim Amount', check: (claim) => Number(claim.co_pay_amount) < Number(claim.claim_amount) },
  { id: 'submitted', label: 'Claim Submitted', check: (claim) => claim.status !== 'pending' }
];

export default function ClaimPreviewModal({ claim, patients, invoices, schemes, onClose, onExport }) {
  const [exporting, setExporting] = useState(false);
  const [validations, setValidations] = useState([]);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    // Run all validation rules
    const results = VALIDATION_RULES.map(rule => ({
      id: rule.id,
      label: rule.label,
      passed: rule.check(claim, schemes)
    }));
    setValidations(results);
  }, [claim, schemes]);

  const patient = patients.find(p => p.id === claim.patient_id);
  const invoice = invoices.find(i => i.id === claim.invoice_id);
  const scheme = schemes.find(s => s.id === claim.scheme_id);
  const allPassed = validations.every(v => v.passed);

  const handleExport = async () => {
    if (!allPassed) {
      alert('Please fix validation errors before exporting');
      return;
    }
    setExportError(null);
    setExporting(true);
    try {
      await onExport();
    } catch (e) {
      setExportError(e.message || 'Export failed. Please check the claim data and try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg font-semibold">Claim Preview & Validation</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Claim Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Patient</p>
            <p className="text-sm font-semibold mt-1">{patient ? `${patient.first_name} ${patient.last_name}` : "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Invoice</p>
            <p className="text-sm font-semibold mt-1">{invoice?.invoice_number || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Scheme</p>
            <p className="text-sm font-semibold mt-1">{scheme?.name || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Status</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border border-primary/20 bg-primary/5 text-primary mt-1 capitalize">
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

        {/* Error Alert */}
        {exportError && (
          <div className="mb-6 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-xs font-semibold text-destructive mb-1">Export Error</p>
            <p className="text-xs text-destructive">{exportError}</p>
          </div>
        )}

        {/* Validation Checklist */}
        <div className="mb-6">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-chart-2" /> Export Validation Checklist
          </h4>
          <div className="space-y-2">
            {validations.map(v => (
              <div
                key={v.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  v.passed
                    ? "bg-chart-3/5 border-chart-3/20"
                    : "bg-destructive/5 border-destructive/20"
                }`}
              >
                {v.passed ? (
                  <CheckCircle className="w-4 h-4 text-chart-3 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                )}
                <span className={`text-sm ${v.passed ? "text-chart-3" : "text-destructive"}`}>
                  {v.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs text-muted-foreground font-medium mb-2">Financial Summary</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Claim Amount</p>
              <p className="font-semibold">MWK {(claim.claim_amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Co-pay</p>
              <p className="font-semibold">MWK {(claim.co_pay_amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-semibold">MWK {((Number(claim.claim_amount) || 0) + (Number(claim.co_pay_amount) || 0)).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={!allPassed || exporting}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              allPassed && !exportError
                ? "bg-chart-3 text-white hover:bg-chart-3/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Exporting..." : "Export Claim Form"}
          </button>
          <button
            onClick={() => {
              setExportError(null);
              onClose();
            }}
            className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}