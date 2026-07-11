import { useState } from "react";
import { ChevronRight } from "lucide-react";
import LibertyClaimForm from "./ClaimForms/LibertyclaimForm";
import MraClaimForm from "./ClaimForms/MraclaimForm";
import WemasClaimForm from "./ClaimForms/WemasclaimForm";
import ZamzamClaimForm from "./ClaimForms/ZamzamclaimForm";
import MasmClaimForm from "./ClaimForms/MasmclaimForm";
import ResmaidClaimForm from "./ClaimForms/ResmaidclaimForm";
import MedhealthClaimForm from "./ClaimForms/MedhealthclaimForm";
import NabmasClaimForm from "./ClaimForms/NabmasclaimForm";
import HorizonClaimForm from "./ClaimForms/HorizonclaimForm";
import MtoweraClaimForm from "./ClaimForms/MtoweraClaimForm";
import UnimedClaimForm from "./ClaimForms/UnimedclaimForm";
import PreciousClaimForm from "./ClaimForms/PreciousclaimForm";

const SCHEMES = [
  { id: "liberty", name: "Liberty Health Cover", icon: "🛡️" },
  { id: "mra", name: "Malawi Revenue Authority (MRA)", icon: "📋" },
  { id: "wemas", name: "Wella Medical Aid Society (WEMAS)", icon: "🏥" },
  { id: "zamzam", name: "Zamzam Medical", icon: "🩺" },
  { id: "masm", name: "Medical Aid Society of Malawi (MASM)", icon: "⚕️" },
  { id: "resmaid", name: "Reserve Bank of Malawi (RESMAID)", icon: "🏦" },
  { id: "medhealth", name: "Medhealth", icon: "💊" },
  { id: "nabmas", name: "National Bank of Malawi (NABMAS)", icon: "🏛️" },
  { id: "horizon", name: "Horizon Health", icon: "🌅" },
  { id: "mtowera", name: "Mtowera Private Clinic", icon: "🏢" },
  { id: "unimed", name: "University of Malawi (UNIMED)", icon: "🎓" },
  { id: "precious", name: "Precious Medical International", icon: "💎" },
];

const FORM_COMPONENTS = {
  liberty: LibertyClaimForm,
  mra: MraClaimForm,
  wemas: WemasClaimForm,
  zamzam: ZamzamClaimForm,
  masm: MasmClaimForm,
  resmaid: ResmaidClaimForm,
  medhealth: MedhealthClaimForm,
  nabmas: NabmasClaimForm,
  horizon: HorizonClaimForm,
  mtowera: MtoweraClaimForm,
  unimed: UnimedClaimForm,
  precious: PreciousClaimForm,
};

export default function InsuranceClaimFormBuilder() {
  const [selectedScheme, setSelectedScheme] = useState(null);

  if (!selectedScheme) {
    return (
      <div className="page-container">
        <h1 className="section-title mb-8">Insurance Claim Form Builder</h1>
        <p className="text-muted-foreground mb-8">Select a medical aid scheme to begin creating a claim form.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCHEMES.map(scheme => (
            <button
              key={scheme.id}
              onClick={() => setSelectedScheme(scheme.id)}
              className="bg-card border border-border/60 rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{scheme.icon}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-heading font-semibold text-sm">{scheme.name}</h3>
              <p className="text-xs text-muted-foreground mt-2">Click to open form</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Get form component based on selected scheme
  const scheme = SCHEMES.find(s => s.id === selectedScheme);
  const FormComponent = FORM_COMPONENTS[selectedScheme];

  return (
    <div className="page-container">
      <button
        onClick={() => setSelectedScheme(null)}
        className="mb-6 text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1"
      >
        ← Back to Schemes
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">{scheme.icon}</span>
        <div>
          <h1 className="section-title">{scheme.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">Claim Form</p>
        </div>
      </div>
      <FormComponent />
    </div>
  );
}