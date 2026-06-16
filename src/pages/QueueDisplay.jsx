import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, Users, ChevronRight } from "lucide-react";

function maskName(name) {
  if (!name) return "***";
  const parts = name.split(" ");
  const last = parts[parts.length - 1];
  return parts.length > 1
    ? `${parts[0].charAt(0)}. ${last}`
    : `${name.charAt(0)}${"*".repeat(Math.max(1, name.length - 1))}`;
}

export default function QueueDisplay() {
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [v, p] = await Promise.all([
          base44.entities.Visit.filter(
            { queue_status: { $in: ["waiting", "triaged", "in_consultation", "in_lab", "in_pharmacy"] } },
            "-priority",
            50
          ),
          base44.entities.Patient.list("", 500),
        ]);
        setVisits(v);
        setPatients(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPatientName = (pid) => {
    const p = patients.find(pt => pt.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  const statusLabels = {
    waiting: "Waiting",
    triaged: "Triaged",
    in_consultation: "With Doctor",
    in_lab: "At Lab",
    in_pharmacy: "At Pharmacy",
  };

  const waiting = visits.filter(v => v.queue_status === "waiting");
  const inProgress = visits.filter(v => v.queue_status !== "waiting");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-700 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">Zomba City Private Clinic</h1>
            <p className="text-gray-400 text-sm mt-1">Patient Queue Display</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-teal-400">
              {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-gray-500 text-sm">
              {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Now Serving */}
        {inProgress.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-heading font-semibold text-teal-400 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> Now Serving
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgress.map(v => (
                <div key={v.id} className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-5">
                  <p className="text-xl font-bold">{maskName(getPatientName(v.patient_id))}</p>
                  <p className="text-sm text-teal-400 mt-1">{statusLabels[v.queue_status] || v.queue_status}</p>
                  <p className="text-xs text-gray-500 mt-2">Checked in: {new Date(v.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting Queue */}
        <div>
          <h2 className="text-lg font-heading font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Waiting Queue ({waiting.length})
          </h2>
          {waiting.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {waiting.map((v, idx) => (
                <div key={v.id} className="flex items-center gap-4 bg-gray-900/50 border border-gray-800 rounded-lg px-5 py-4 hover:border-gray-700 transition-colors">
                  <span className="text-2xl font-mono font-bold text-gray-700 w-10">{String(idx + 1).padStart(2, "0")}</span>
                  <div className="flex-1">
                    <p className="text-lg font-semibold">{maskName(getPatientName(v.patient_id))}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(v.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {v.visit_type}
                    </p>
                  </div>
                  {v.priority === "emergency" && (
                    <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold uppercase">Emergency</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-700" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-800 text-center text-gray-600 text-xs">
          <p>Please wait for your name to be called. For inquiries, visit the reception desk.</p>
          <p className="mt-1">This display refreshes automatically · Zomba City Private Clinic HIMS</p>
        </div>
      </div>
    </div>
  );
}