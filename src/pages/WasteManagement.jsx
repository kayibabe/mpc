import WasteManagement from "@/components/WasteManagement";
import PageHeader from "@/components/ui/PageHeader";
import { Trash2 } from "lucide-react";

export default function WasteManagementPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Waste Management"
        subtitle="Hazardous & general clinical waste tracking with staff signature verification"
        icon={Trash2}
        className="mb-6"
      />
      <WasteManagement />
    </div>
  );
}