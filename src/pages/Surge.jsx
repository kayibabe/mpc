import React, { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useSurgeStatus } from "@/lib/useSurgeStatus";
import PageHeader from "@/components/ui/PageHeader";
import { Siren, AlertTriangle, CheckCircle, Users, BedDouble, Activity, RefreshCw } from "lucide-react";

const LEVEL_META = {
  normal: { label: "Normal", color: "text-clinical-normal", bg: "bg-clinical-normal/5 border-clinical-normal/20", badge: "bg-clinical-normal/10 text-clinical-normal", icon: CheckCircle },
  high: { label: "High", color: "text-triage-urgent", bg: "bg-triage-urgent/5 border-triage-urgent/30", badge: "bg-triage-urgent/10 text-triage-urgent", icon: AlertTriangle },
  critical: { label: "Critical", color: "text-destructive", bg: "bg-destructive/5 border-destructive/40", badge: "bg-destructive/10 text-destructive", icon: Siren },
};

const METRIC_ICONS = { er: Users, beds: BedDouble, emergency: Activity };

export default function Surge() {
  const { status, loading } = useSurgeStatus();
  const [running, setRunning] = useState(false);
  const [protocol, setProtocol] = useState(null);

  const runProtocols = async () => {
    setRunning(true);
    try {
      const { data } = await base44.functions.invoke("emergencySurgeCapacity", {});
      setProtocol(data);
    } catch (e) {
      toast({ title: "Surge protocol failed", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="page-container flex justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const overall = status?.overall || "normal";
  const OverallIcon = LEVEL_META[overall].icon;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Patient Surge Monitor" subtitle="Live capacity & overcrowding alerts" icon={Siren}>
        <button
          onClick={runProtocols}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} /> Run Surge Protocols
        </button>
      </PageHeader>

      {/* Overall status */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${LEVEL_META[overall].bg}`}>
        <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${LEVEL_META[overall].badge}`}>
          <OverallIcon className={`w-7 h-7 ${overall === "critical" ? "animate-pulse" : ""}`} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Surge Level</p>
          <p className={`text-2xl font-bold ${LEVEL_META[overall].color}`}>{LEVEL_META[overall].label}</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {status?.metrics.map(m => {
          const meta = LEVEL_META[m.level];
          const MetricIcon = METRIC_ICONS[m.key] || Activity;
          return (
            <div key={m.key} className={`rounded-xl border p-4 ${meta.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                  <MetricIcon className="w-4.5 h-4.5" />
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}>
                  {meta.label}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{m.label}</p>
              <p className={`text-lg font-bold mt-1 ${meta.color}`}>{m.display}</p>
            </div>
          );
        })}
      </div>

      {/* Protocol results */}
      {protocol && (
        <div className="bg-card rounded-xl border border-border/60 p-5 space-y-3">
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Siren className="w-4 h-4 text-primary" /> Protocol Assessment
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-muted font-medium">ER Census: {protocol.er_census}</span>
            <span className="px-2 py-1 rounded-lg bg-muted font-medium">Capacity: {protocol.capacity_pct}%</span>
            <span className="px-2 py-1 rounded-lg bg-muted font-medium">Available Beds: {protocol.available_beds}</span>
            <span className="px-2 py-1 rounded-lg bg-muted font-medium capitalize">Level: {protocol.surge_level}</span>
          </div>
          {protocol.actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommended Actions</p>
              <ul className="space-y-1">
                {protocol.actions.map((a, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {protocol.protocols_activated?.length > 0 && (
            <p className="text-xs text-muted-foreground">Status: {protocol.protocols_activated.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}