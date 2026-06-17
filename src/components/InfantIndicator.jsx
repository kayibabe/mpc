import { Baby, AlertCircle } from "lucide-react";

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  return { years, months };
};

export default function InfantIndicator({ dateOfBirth, size = "md", showLabel = true }) {
  const ageObj = calculateAge(dateOfBirth);
  
  if (!ageObj || ageObj.years > 0) return null;

  const isNewborn = ageObj.months === 0;
  const sizeMap = {
    sm: { icon: "w-3 h-3", badge: "px-2 py-0.5 text-[10px]", label: "text-xs" },
    md: { icon: "w-4 h-4", badge: "px-2.5 py-1 text-xs", label: "text-sm" },
    lg: { icon: "w-5 h-5", badge: "px-3 py-1.5 text-sm", label: "text-base" },
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeMap[size].badge} rounded-full font-semibold flex items-center gap-1 ${
          isNewborn
            ? "bg-triage-emergency/15 text-triage-emergency border border-triage-emergency/30"
            : "bg-triage-urgent/15 text-triage-urgent border border-triage-urgent/30"
        }`}
      >
        {isNewborn ? (
          <>
            <AlertCircle className={sizeMap[size].icon} />
            {showLabel && <span>Newborn</span>}
          </>
        ) : (
          <>
            <Baby className={sizeMap[size].icon} />
            {showLabel && <span>{ageObj.months} mo</span>}
          </>
        )}
      </div>
    </div>
  );
}