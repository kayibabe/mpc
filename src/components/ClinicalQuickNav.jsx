import { Heart, Pill, FileText } from "lucide-react";

export default function ClinicalQuickNav({ activeTab, onTabChange, compact = false }) {
  const tabs = [
    { id: "vitals", label: "Vitals", icon: Heart, color: "text-destructive" },
    { id: "consultation", label: "Notes", icon: FileText, color: "text-primary" },
    { id: "prescriptions", label: "Rx", icon: Pill, color: "text-chart-2" },
  ];

  if (compact) {
    return (
      <div className="sticky top-4 z-40 flex gap-1.5 justify-center mb-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`p-2 rounded-full transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-white border border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sticky top-4 z-40 flex gap-2 justify-center mb-4 px-4">
      <div className="inline-flex bg-white border border-border rounded-full p-1 shadow-sm">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "" : tab.color}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}