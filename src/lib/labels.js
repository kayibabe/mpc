/** Human-readable labels for domain enums used throughout the UI. */

export const QUEUE_STATUS_LABELS = {
  waiting: "Waiting",
  triaged: "Triaged",
  in_consultation: "In Consultation",
  in_lab: "In Lab",
  in_pharmacy: "In Pharmacy",
  in_imaging: "In Imaging",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const VISIT_TYPE_LABELS = {
  outpatient: "OPD",
  inpatient: "IPD",
  emergency: "Emergency",
  anc: "ANC",
  postnatal: "PNC",
  procedure: "Procedure",
};

export const PRIORITY_LABELS = {
  emergency: "Emergency",
  urgent: "Urgent",
  normal: "Routine",
  routine: "Routine",
};

/** Fallback: capitalise words and replace underscores */
export function humanise(str) {
  if (!str) return "—";
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export const queueLabel = (status) => QUEUE_STATUS_LABELS[status] || humanise(status);
export const visitLabel = (type) => VISIT_TYPE_LABELS[type] || humanise(type);
export const priorityLabel = (p) => PRIORITY_LABELS[p] || humanise(p);
