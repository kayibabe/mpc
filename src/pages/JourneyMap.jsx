import JourneyMap from "@/components/JourneyMap";
import PageHeader from "@/components/ui/PageHeader";
import { GitBranch } from "lucide-react";

export default function JourneyMapPage() {
  return (
    <div className="page-container">
      <PageHeader title="Patient Journey Map" subtitle="Kanban-style view of all active patient journeys across the hospital workflow." icon={GitBranch} className="mb-6" />
      <JourneyMap />
    </div>
  );
}