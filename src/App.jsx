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
import MoHReports from '@/pages/MoHReports';
import Layout from '@/components/Layout';

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
        <Route path="/moh-reports" element={<MoHReports />} />
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
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App