import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Dashboard from '@/pages/Dashboard';
import Reception from '@/pages/Reception';
import Appointments from '@/pages/Appointments';
import Clinical from '@/pages/Clinical';
import Lab from '@/pages/Lab';
import Imaging from '@/pages/Imaging';
import Pharmacy from '@/pages/Pharmacy';
import Inpatient from '@/pages/Inpatient';
import Maternal from '@/pages/Maternal';
import Billing from '@/pages/Billing';
import Admin from '@/pages/Admin';
import PatientPortal from '@/pages/PatientPortal';
import QueueDisplay from '@/pages/QueueDisplay';
import Calendar from '@/pages/Calendar';
import Nursing from '@/pages/Nursing';
import WasteManagementPage from '@/pages/WasteManagement';
import SignatureAudit from '@/pages/SignatureAudit';
import DoctorHandover from '@/pages/DoctorHandover';
import MySignatures from '@/pages/MySignatures';
import PhysicianPerformance from '@/pages/PhysicianPerformance';
import MoHReports from '@/pages/MoHReports';
import TriageSummary from '@/pages/TriageSummary';
import SurgeryCalendar from '@/pages/SurgeryCalendar';
import JourneyMap from '@/pages/JourneyMap';
import DoctorScheduling from '@/pages/DoctorSchedule';
import StaffShiftDashboard from '@/pages/StaffShiftDashboard';
import InsuranceClaimPortal from '@/pages/InsuranceClaimPortal';
import DoctorPerformanceReport from '@/pages/DoctorPerformanceReport';
import InventoryAudit from '@/pages/InventoryAudit';
import PatientFeedback from '@/pages/PatientFeedback';
import RadiologyReportLibrary from '@/pages/RadiologyReportLibrary';
import SurgicalSupplyInventory from '@/pages/SurgicalSupplyInventory';
import SurgicalRequisitions from '@/pages/SurgicalRequisitions';
import SurgicalDispensing from '@/pages/SurgicalDispensing';
import SurgicalSupplyTracker from '@/pages/SurgicalSupplyTracker';
import SurgicalDashboard from '@/pages/SurgicalDashboard';
import DischargeChecklistFlow from '@/pages/DischargeChecklistFlow';
import PatientIntake from '@/pages/PatientIntake';
import TreatmentAdherence from '@/pages/TreatmentAdherence';
import PatientHistory from '@/pages/PatientHistory';
import Surge from '@/pages/Surge';
import PatientOutcomeTracker from '@/pages/PatientOutcomeTracker';
import TotpSetup from '@/pages/TotpSetup';
import TotpManagement from '@/pages/TotpManagement';
import ClinicalAuditLog from '@/pages/ClinicalAuditLog';
import EmergencyAlertSystem from '@/components/EmergencyAlertSystem';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import CustomLogin from '@/pages/CustomLogin';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/custom-login" element={<CustomLogin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/totp-setup" element={<TotpSetup />} />
      <Route path="/totp-management" element={<TotpManagement />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reception" element={<Reception />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/clinical" element={<Clinical />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/imaging" element={<Imaging />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/inpatient" element={<Inpatient />} />
        <Route path="/maternal" element={<Maternal />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/portal" element={<PatientPortal />} />
        <Route path="/queue" element={<QueueDisplay />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/nursing" element={<Nursing />} />
        <Route path="/waste" element={<WasteManagementPage />} />
        <Route path="/signature-audit" element={<SignatureAudit />} />
        <Route path="/doctor-handover" element={<DoctorHandover />} />
        <Route path="/my-signatures" element={<MySignatures />} />
        <Route path="/physician-performance" element={<PhysicianPerformance />} />
        <Route path="/moh-reports" element={<MoHReports />} />
        <Route path="/triage" element={<TriageSummary />} />
        <Route path="/surgery-calendar" element={<SurgeryCalendar />} />
        <Route path="/journey-map" element={<JourneyMap />} />
        <Route path="/doctor-schedule" element={<DoctorScheduling />} />
        <Route path="/staff-shifts" element={<StaffShiftDashboard />} />
        <Route path="/insurance-claims" element={<InsuranceClaimPortal />} />
        <Route path="/doctor-performance" element={<DoctorPerformanceReport />} />
        <Route path="/inventory-audit" element={<InventoryAudit />} />
        <Route path="/patient-feedback" element={<PatientFeedback />} />
        <Route path="/radiology-reports" element={<RadiologyReportLibrary />} />
        <Route path="/surgical-supplies" element={<SurgicalSupplyInventory />} />
        <Route path="/surgical-requisitions" element={<SurgicalRequisitions />} />
        <Route path="/surgical-dispensing" element={<SurgicalDispensing />} />
        <Route path="/surgical-supply-tracker" element={<SurgicalSupplyTracker />} />
        <Route path="/surgical-dashboard" element={<SurgicalDashboard />} />
        <Route path="/discharge-checklist" element={<DischargeChecklistFlow />} />
        <Route path="/patient-intake" element={<PatientIntake />} />
        <Route path="/treatment-adherence" element={<TreatmentAdherence />} />
        <Route path="/patient-outcomes" element={<PatientOutcomeTracker />} />
        <Route path="/audit-logs" element={<ClinicalAuditLog />} />
        <Route path="/patient-history" element={<PatientHistory />} />
        <Route path="/surge" element={<Surge />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
          <EmergencyAlertSystem />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App