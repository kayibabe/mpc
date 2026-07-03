import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, MessageSquare, Clock, Loader2 } from "lucide-react";

export default function ClaimRejectionTracker() {
  const [rejections, setRejections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [patients, setPatients] = useState({});

  useEffect(() => {
    loadRejections();
  }, []);

  const loadRejections = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.filter(
        { status: "rejected" },
        "-created_date",
        100
      );
      setRejections(data);

      // Load patient names
      const pMap = {};
      await Promise.all(
        data.map(async (claim) => {
          if (claim.patient_id && !pMap[claim.patient_id]) {
            try {
              const p = await base44.entities.Patient.get(claim.patient_id);
              if (p) pMap[claim.patient_id] = `${p.first_name} ${p.last_name}`;
            } catch (_) {}
          }
        })
      );
      setPatients(pMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const triggerRejectionNotifications = async () => {
    setNotifying(true);
    try {
      const { data } = await base44.functions.invoke("notifyRejectedClaims", {});
      alert(`✅ Notified ${data.notified} rejection(s)`);
      await loadRejections();
    } catch (e) {
      alert("Notification failed: " + e.message);
    } finally {
      setNotifying(false);
    }
  };

  const resubmitClaim = async (claimId) => {
    try {
      await base44.entities.InsuranceClaim.update(claimId, {
        status: "pending",
        response_notes: null
      });
      await loadRejections();
    } catch (e) {
      alert("Resubmit failed: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" /> Rejection Tracker
        </h3>
        <button
          onClick={triggerRejectionNotifications}
          disabled={notifying || rejections.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 disabled:opacity-50"
        >
          {notifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
          {notifying ? "Notifying..." : "Notify Rejections"}
        </button>
      </div>

      {rejections.length === 0 ? (
        <div className="py-8 text-center">
          <AlertTriangle className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No rejected claims.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rejections.map((claim) => (
            <div key={claim.id} className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-destructive">
                    {patients[claim.patient_id] || claim.patient_id?.slice(0, 8) || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {claim.scheme_name} · MWK {(claim.claim_amount || 0).toLocaleString()}
                  </p>
                  {claim.response_date && (
                    <p className="text-xs text-destructive/60 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(claim.response_date).toLocaleDateString("en-GB")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => resubmitClaim(claim.id)}
                  className="px-2.5 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium hover:bg-destructive/20 flex-shrink-0"
                >
                  Resubmit
                </button>
              </div>

              {claim.response_notes && (
                <div className="mt-3 p-2 bg-background rounded border border-destructive/10">
                  <p className="text-xs font-medium text-destructive mb-1">Rejection Reason:</p>
                  <p className="text-xs text-foreground">{claim.response_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}