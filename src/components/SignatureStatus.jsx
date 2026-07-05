import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PenTool, Check, Clock } from "lucide-react";

export default function SignatureStatus({ documentType, documentId, compact = false }) {
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sigs = await base44.entities.DigitalSignature.filter(
          { document_type: documentType, document_id: documentId },
          "-created_date",
          1
        );
        if (sigs.length > 0) {
          const sig = sigs[0];
          if (sig.signature_url) {
            try {
              const { data } = await base44.functions.invoke("getSignedUrl", { file_uri: sig.signature_url });
              sig.displayUrl = data?.signed_url || sig.signature_url;
            } catch {
              sig.displayUrl = sig.signature_url;
            }
          }
          setSignature(sig);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [documentType, documentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!signature) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
          <PenTool className="w-3 h-3" /> Unsigned
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <PenTool className="w-3.5 h-3.5" /> Not yet signed
      </div>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-3/10 text-chart-3">
        <Check className="w-3 h-3" /> Signed
      </span>
    );
  }

  return (
    <div className="p-3 bg-chart-3/5 border border-chart-3/20 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-chart-3/10 flex items-center justify-center flex-shrink-0">
          <PenTool className="w-4 h-4 text-chart-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Digitally Signed</p>
          <p className="text-xs text-muted-foreground">{signature.signed_by_name}</p>
          <p className="text-[10px] text-muted-foreground/70">{signature.signed_by_title}</p>
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5" />
            {new Date(signature.signed_at).toLocaleString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        {signature.displayUrl && (
          <img
            src={signature.displayUrl}
            alt="Signature"
            className="w-24 h-10 object-contain border border-border rounded bg-white"
          />
        )}
      </div>
    </div>
  );
}