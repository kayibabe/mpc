import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Search, RefreshCw, Filter, BarChart3 } from "lucide-react";

export default function ClinicalAuditLog() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const logs = await base44.entities.AuditLog?.list?.("-created_date", 500) || [];
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.action?.toLowerCase().includes(searchInput.toLowerCase()) ||
      log.user_id?.includes(searchInput.toLowerCase());
    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntity = filterEntity === "all" || log.entity_type === filterEntity;
    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueActions = [...new Set(auditLogs.map(l => l.action))];
  const uniqueEntities = [...new Set(auditLogs.map(l => l.entity_type))];

  const actionCounts = {
    create: auditLogs.filter(l => l.action === "create").length,
    update: auditLogs.filter(l => l.action === "update").length,
    delete: auditLogs.filter(l => l.action === "delete").length,
    view: auditLogs.filter(l => l.action === "view").length,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Clinical Audit Log</h2>
          <p className="text-sm text-muted-foreground mt-1">Track all clinical data changes and user actions</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(actionCounts).map(([action, count]) => (
          <div key={action} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground capitalize mb-1">{action} Actions</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-sm mb-6 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search user or action..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>

        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Entities</option>
          {uniqueEntities.map(entity => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No audit logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Entity Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Entity ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Changes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  let changes = null;
                  try {
                    changes = typeof log.changes === "string" ? JSON.parse(log.changes) : log.changes;
                  } catch (e) {
                    changes = null;
                  }

                  return (
                    <tr key={log.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-3 px-4 text-xs">
                        {new Date(log.timestamp).toLocaleString("en-GB")}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{log.user_id?.slice(0, 8)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.action === "create" ? "bg-chart-3/10 text-chart-3" :
                          log.action === "update" ? "bg-primary/10 text-primary" :
                          log.action === "delete" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">{log.entity_type}</td>
                      <td className="py-3 px-4 font-mono text-xs">{log.entity_id?.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {changes ? Object.keys(changes).length > 0 ? Object.keys(changes).join(", ") : "—" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-4">Action Distribution</h4>
          <div className="space-y-2">
            {Object.entries(actionCounts).map(([action, count]) => (
              <div key={action} className="flex items-center justify-between">
                <span className="text-sm capitalize">{action}</span>
                <span className="font-mono font-semibold">{count}</span>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(count / auditLogs.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
          <h4 className="font-heading font-semibold text-sm mb-4">Entity Types</h4>
          <div className="space-y-2">
            {uniqueEntities.slice(0, 6).map(entity => {
              const count = auditLogs.filter(l => l.entity_type === entity).length;
              return (
                <div key={entity} className="flex items-center justify-between">
                  <span className="text-sm">{entity}</span>
                  <span className="font-mono font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}