import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Download, FileJson, Trash2, Loader2, Calendar, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function DHIS2ReportsDownloads() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const reps = await base44.entities.DHIS2Export.list("-export_date", 100);
      setReports(reps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = (report) => {
    try {
      const data = typeof report.data === "string" ? JSON.parse(report.data) : report.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhis2_report_${report.period}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download: " + e.message);
    }
  };

  const downloadCSV = (report) => {
    try {
      const data = typeof report.data === "string" ? JSON.parse(report.data) : report.data;
      
      const flattenData = (obj, prefix = "") => {
        const rows = [];
        const headers = new Set();
        
        const flatten = (o, p) => {
          Object.entries(o).forEach(([k, v]) => {
            const key = p ? `${p}_${k}` : k;
            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
              flatten(v, key);
            } else {
              headers.add(key);
              rows.push({ key, value: v });
            }
          });
        };
        
        flatten(obj, prefix);
        return { headers: Array.from(headers), rows };
      };

      const { headers, rows } = flattenData(data);
      const csv = [
        headers.join(","),
        ...rows
          .map(r => headers.map(h => {
            const val = rows.find(x => x.key === h)?.value;
            return JSON.stringify(val || "").replace(/"/g, '""');
          }).join(","))
          .filter((v, i, a) => a.indexOf(v) === i),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhis2_report_${report.period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download: " + e.message);
    }
  };

  const deleteReport = async (reportId) => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    
    setDeleting(reportId);
    try {
      await base44.entities.DHIS2Export.delete(reportId);
      setReports(reports.filter(r => r.id !== reportId));
      setSelectedReport(null);
    } catch (e) {
      alert("Failed to delete: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const filteredReports = reports.filter(r => 
    filter === "all" || r.status === filter
  );

  const statusIcon = (status) => {
    switch (status) {
      case "submitted":
        return <CheckCircle className="w-4 h-4 text-chart-3" />;
      case "validated":
        return <CheckCircle className="w-4 h-4 text-primary" />;
      case "draft":
        return <Clock className="w-4 h-4 text-chart-2" />;
      case "failed":
      case "rejected":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case "submitted":
        return "bg-chart-3/10 text-chart-3";
      case "validated":
        return "bg-primary/10 text-primary";
      case "draft":
        return "bg-chart-2/10 text-chart-2";
      case "failed":
      case "rejected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted/60";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold mb-2">DHIS2 Reports Library</h3>
        <p className="text-xs text-muted-foreground">All generated DHIS2 reports saved and ready for download</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "All Reports", value: "all" },
          { label: "Drafts", value: "draft" },
          { label: "Validated", value: "validated" },
          { label: "Submitted", value: "submitted" },
          { label: "Failed", value: "failed" },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === tab.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted/50"
            }`}
          >
            {tab.label} ({reports.filter(r => tab.value === "all" || r.status === tab.value).length})
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-card rounded-lg border border-border/60 p-12 text-center">
          <FileJson className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No reports found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredReports.map(report => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
              className="bg-card rounded-lg border border-border/60 p-4 hover:shadow-sm transition-all cursor-pointer"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="font-semibold truncate">{report.period}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {report.report_type?.toUpperCase()} • Data Quality: {report.data_quality_score || "N/A"}%
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {statusIcon(report.status)}
                  {selectedReport?.id === report.id ? "−" : "+"}
                </div>
              </div>

              {/* Expanded View */}
              {selectedReport?.id === report.id && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-3">
                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                    <div>
                      <p className="text-muted-foreground mb-0.5">Created</p>
                      <p className="font-semibold">
                        {report.export_date
                          ? new Date(report.export_date).toLocaleDateString("en-GB")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Exported By</p>
                      <p className="font-semibold truncate">{report.exported_by || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Facility</p>
                      <p className="font-semibold">{report.facility_name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Data Quality</p>
                      <p className="font-semibold">{report.data_quality_score || 0}%</p>
                    </div>
                  </div>

                  {/* Validation Errors (if any) */}
                  {report.validation_errors && (
                    <div className="p-2 bg-destructive/5 border border-destructive/20 rounded text-[10px] text-destructive">
                      <p className="font-semibold mb-1">Validation Issues:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {JSON.parse(report.validation_errors).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        downloadJSON(report);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20"
                    >
                      <Download className="w-3.5 h-3.5" /> JSON
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        downloadCSV(report);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-chart-1/10 text-chart-1 rounded-lg text-xs font-medium hover:bg-chart-1/20"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    {report.status === "draft" && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteReport(report.id);
                        }}
                        disabled={deleting === report.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 disabled:opacity-50"
                      >
                        {deleting === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}