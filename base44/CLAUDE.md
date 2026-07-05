# base44/ — Base44 platform app source

> **⚠️ Do not move, rename, or regroup files in this folder.** The flat layout
> (`entities/<Name>.jsonc`, `functions/<name>/entry.ts`) is what the Base44
> platform tooling expects; restructuring it can break platform sync.
> Sync status is unverified — before ever restructuring, confirm whether app
> `6a31ab83c014cd4c6a751648` (see `.app.jsonc`) is still pulled/pushed, via the
> Base44 dashboard or the Base44 MCP `list_user_apps` tool.
> Pending operator action (see `AUDIT_WORKING_DOCUMENT.md`): push the updated
> entity RLS files (Bed/Ward/DrugInteraction/Patient) to the platform.

**What this is:** the low-code Base44 app behind the root React frontend
(`src/pages/*.jsx`). In Base44 mode the pages talk to these entities and
functions directly. In self-hosted mode the adapter `src/api/customClient.js`
maps entity calls onto the FastAPI backend (`backend/`) — but only for the
entities marked **LIVE** below; **STUB** entities return empty lists and
fake-successful saves, and **UNMAPPED** entities hit the unknown-entity stub
with a console warning.

**Security:** finding **C11** (59+ `asServiceRole` uses across these 102
functions) is still OPEN — prioritized function list under C11 in
`AUDIT_WORKING_DOCUMENT.md`. 8 high-risk functions were already fixed
(commit `1920186`).

---

## Entities (66) — `entities/<Name>.jsonc`, one schema per file

Status = behaviour in self-hosted mode via `src/api/customClient.js`
(`ENTITY_DEFS` → LIVE, `STUB_ENTITIES` → STUB, in neither → UNMAPPED).

### Patients & visits
| Entity | Status | Backend mapping / purpose |
|---|---|---|
| Patient | LIVE | `/api/v1/patients` |
| Visit | LIVE | `/api/v1/encounters` (Base44 calls encounters "Visit") |
| Appointment | LIVE | `/api/v1/appointments` (date/time/type/doctor_id transforms, PATCH) |
| Consultation | UNMAPPED | consult record (backend uses clinical notes instead) |
| Diagnosis | STUB | ICD diagnosis rows (backend stores diagnoses JSON on notes) |
| PatientAllergy | STUB | allergy rows (backend stores `known_allergies` on Patient) |
| PatientJourney | STUB | journey-stage tracking for JourneyMap page |
| Immunization | UNMAPPED | vaccination records |
| Notification | STUB | in-app notifications |

### Clinical planning & nursing tasks
| Entity | Status | Purpose |
|---|---|---|
| VitalSigns | LIVE | `/api/v1/nursing/vitals` |
| ClinicalPlan | STUB | multi-order care plans (see `splitClinicalPlanToOrders`) |
| ClinicalTemplate | STUB | reusable clinical note templates |
| NursingCarePlan | STUB | nursing care plans |
| NurseTask | STUB | nurse task assignments |

### Wards, admission & handover
| Entity | Status | Purpose |
|---|---|---|
| Ward | LIVE | `/api/v1/admissions/wards` |
| Bed | LIVE | `/api/v1/admissions/beds` |
| Admission | LIVE | `/api/v1/admissions` |
| WardTransfer | STUB | inter-ward transfers |
| Discharge | STUB | discharge records (backend: discharge fields on Admission + billing clearance) |
| DoctorHandover | STUB | doctor-to-doctor handover (backend: nursing notes `note_type=handover`) |
| DoctorSchedule | STUB | duty rosters |
| HandoverTemplate | STUB | handover note templates |
| ShiftHandoverLog | STUB | shift handover log |

### Surgical / theatre
| Entity | Status | Purpose |
|---|---|---|
| SurgicalBooking | STUB* | theatre bookings — backend module exists (`/api/v1/theatre/cases`) but the page model lacks encounter/surgeon FKs; needs a UI iteration to wire |
| SurgicalChecklist | STUB* | pre-op checklist — backend: `POST /api/v1/theatre/cases/{id}/preop-checklist` |
| SurgicalRequisition | STUB | theatre supply requisitions |
| SurgicalDispensing | STUB | theatre supply issue |
| SurgicalSupplyKit | STUB | procedure supply kits |
| AnesthesiaLog | UNMAPPED | anaesthesia record |
| SterilizationLog | UNMAPPED | instrument sterilisation log |

### Maternity & newborn
| Entity | Status | Purpose |
|---|---|---|
| MaternalVisit | STUB | ANC/PNC visits |
| NewbornRecord | STUB | newborn records |
| PartographEntry | STUB | labour partograph entries |

### Lab & imaging
| Entity | Status | Purpose |
|---|---|---|
| LabOrder | LIVE | `/api/v1/lab/orders` |
| LabResult | LIVE | `/api/v1/lab/results` (read-only flattened view) |
| LabReagent | STUB | reagent inventory |
| ImagingOrder | STUB | radiology orders (backend routes imaging through the lab module) |
| ImagingResult | STUB | radiology reports |

### Pharmacy & inventory
| Entity | Status | Purpose |
|---|---|---|
| Drug | LIVE | `/api/v1/pharmacy/drugs` (stock normalised to `quantity_in_stock`) |
| Prescription | LIVE | `/api/v1/pharmacy/prescriptions` |
| PrescriptionItem | LIVE | `/api/v1/pharmacy/prescription-items` |
| PharmacyDispensing | STUB | dispensing rows (backend: `POST /prescriptions/{id}/dispense`) |
| DrugInteraction | UNMAPPED | interaction rules (backend gate lives in `pharmacy.py::_safety_conflicts`) |
| PharmacyPurchaseOrder | UNMAPPED | purchase orders |
| PharmacyRequisition | UNMAPPED | internal stock requisitions |

### Billing, insurance & schemes
| Entity | Status | Backend mapping / purpose |
|---|---|---|
| Invoice | LIVE | `/api/v1/billing/invoices` |
| InvoiceItem | LIVE | `/api/v1/billing/invoice-items` |
| Payment | LIVE | `/api/v1/billing/payments` (receipts: `GET /billing/payments/{id}/receipt`) |
| InsuranceClaim | LIVE | custom handler → `/api/v1/insurance/claims` (status dispatches to submit/decision/settle) |
| MedicalAidScheme | LIVE | `/api/v1/insurance/insurers` (`scheme_name` ↔ `name`) |
| InvoiceSplit | STUB | split-billing rows (backend: co-pay split on claims) |
| CashierShift | STUB | cashier shift cash-up (backend: `GET /billing/reconciliation`) |
| ExchangeRate | STUB | currency rates |

### Death & mortuary
| Entity | Status | Purpose |
|---|---|---|
| DeathCertificate | STUB* | death certification — backend module exists (`/api/v1/mortuary/deaths`, DC/BRP numbers) but the page is not yet wired |

### Admin, security & compliance
| Entity | Status | Purpose |
|---|---|---|
| User | LIVE | `/api/v1/admin/users` |
| AuditLog | LIVE | `/api/v1/admin/audit-logs` |
| UserSecurity | STUB | TOTP/2FA state |
| LoginSession | STUB | session tracking |
| DigitalSignature | STUB | clinician signatures |
| AuditFlag | STUB | flagged audit events |
| IncidentReport | STUB | incident reporting |
| StaffCompliance | STUB | staff compliance tracking |
| IPCSurveillance | STUB | infection prevention surveillance |
| DHIS2Export | STUB | MoH DHIS2 export batches |
| WasteLog / WasteCategory | STUB | medical waste tracking |

\* backend API exists and is tested; only the adapter/page wiring is missing.

---

## Cloud functions (102) — `functions/<name>/entry.ts` (TypeScript/Deno)

All follow the same shape: `createClientFromRequest(req)` from
`npm:@base44/sdk`, auth check, then entity reads/writes. Grouped by domain:

- **Triage & emergency:** alertOnCriticalVitals, bulkTriage, calculateTriageScore, formalizeTriageWorkflow, emergencySurgeCapacity, patientRiskScoring, readmissionRiskPredictor, waitingTimeBottleneckAnalyzer
- **Appointments & scheduling:** appointmentScheduleSync, autoScheduleFollowUp, automatePatientFollowUps, calendarSync, notifyAppointmentCreated, sendAppointmentReminders, sendSmsReminders, staffAppointmentSync, syncAppointments, syncDailyAppointmentSummary
- **Clinical & care flow:** autoGenerateLabOrders, splitClinicalPlanToOrders (explodes a ClinicalPlan into lab/imaging/drug orders), handleWorkflowStageChange (patient-journey stage machine), updatePatientJourneyStage, patientCommunicationAutomation, syncPatientRecords, bloodBankManagement, nutritionManagement, vaccinationTracker, antibioticStewardship, hosipitalAcquiredInfectionAlert (sic — typo is in the platform name), generateDischargeSummary, autoGenerateDischargeSummary, autoGenerateDischargePackage
- **Nursing & wards:** autoAssignNurseTasks, autoBedAllocation, bedTurnoverAutomation, notifyNursingStation, censusForecast, exportHandoverReport, wardReportSync
- **Surgical & theatre:** autoReserveSupplyKitOnBooking, notifySurgicalSupplyReady, theaterUtilizationOptimizer
- **Lab & imaging:** labResultSync, labToImagingSmartRouting, notifyLabResultReady
- **Pharmacy & inventory:** checkDrugSafety, drugInteractionBlock, monitorDrugStock, checkInventoryAlerts, inventoryExpirationAlert, inventoryPredictiveOrdering, generateInventoryForecast, generateReorderRequests, exportReorderRequestsToSheet, runExpiryAlerts, triggerInventoryAlert, syncPrescriptionToInvoice
- **Billing & revenue:** autoGenerateInvoiceItem, exportInvoicePdf, notifyInvoiceStatus, dailyRevenueAudit, generateRevenueReport, reconcileShift, validateBillingBeforeDischarge, batchExportReports
- **Insurance & claims:** automateClaimExports, automateClaimSubmissions, autoSubmitInsuranceClaim, bulkValidateClaims, exportClaimFormPdf, notifyClaimStatusChange, notifyRejectedClaims, syncClaimsToDrive, syncClaimsToGoogleSheets, validateClaimData, verifyInsurance, auditMedicalSchemeChanges
- **Staff & performance:** analyzePhysicianPerformance, analyzeShiftPerformance, analyzeStaffCompliance, analyzeStaffPerformance, staffBurnoutAlert, staffCredentialing, staffPerformanceAnalytics, syncShiftReports, monitorSLABreaches
- **Security & auth:** generateBackupCodes, generateTotpSecret, loginWithTotp, verifyTotp, saveSignature
- **Audit & compliance:** generateDailyAuditAlerts, liveAuditShift (real-time shift audit snapshot), triggerLiveAudit, logEntityActivity, complaintGrievanceSystem, monitorWasteCompliance, dailyBackupCriticalData
- **Reporting & integrations:** generateDailyReport, generateDHIS2Report (MoH monthly report)
- **Ops/misc:** equipmentMaintenanceTracker, testQueryPerformance (dev utility)

In self-hosted mode, `src/api/customClient.js::invokeFunction` implements only
`generateDailyReport`, `checkInventoryAlerts`, and `runExpiryAlerts`; every
other function invocation returns `{ data: null }` with a console info line.
