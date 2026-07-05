import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

import PatientListPage from './pages/reception/PatientListPage'
import RegisterPatientPage from './pages/reception/RegisterPatientPage'
import PatientDetailPage from './pages/reception/PatientDetailPage'

import EncounterListPage from './pages/opd/EncounterListPage'
import NewEncounterPage from './pages/opd/NewEncounterPage'
import EncounterDetailPage from './pages/opd/EncounterDetailPage'
import TriagePage from './pages/opd/TriagePage'

import InvoiceListPage from './pages/billing/InvoiceListPage'
import CreateInvoicePage from './pages/billing/CreateInvoicePage'
import InvoiceDetailPage from './pages/billing/InvoiceDetailPage'

import LabOrderListPage from './pages/lab/LabOrderListPage'
import NewLabOrderPage from './pages/lab/NewLabOrderPage'
import LabOrderDetailPage from './pages/lab/LabOrderDetailPage'

import DrugListPage from './pages/pharmacy/DrugListPage'
import PrescriptionQueuePage from './pages/pharmacy/PrescriptionQueuePage'
import DispensePage from './pages/pharmacy/DispensePage'

import WardViewPage from './pages/ipd/WardViewPage'
import AdmitPatientPage from './pages/ipd/AdmitPatientPage'
import AdmissionDetailPage from './pages/ipd/AdmissionDetailPage'

import NursingStationPage from './pages/nursing/NursingStationPage'
import RecordVitalsPage from './pages/nursing/RecordVitalsPage'
import MARPage from './pages/nursing/MARPage'

import UserListPage from './pages/admin/UserListPage'
import ReportsPage from './pages/admin/ReportsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        {/* Reception */}
        <Route path="/reception" element={<ProtectedRoute><PatientListPage /></ProtectedRoute>} />
        <Route path="/reception/register" element={<ProtectedRoute><RegisterPatientPage /></ProtectedRoute>} />
        <Route path="/reception/patients/:patientId" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />

        {/* OPD */}
        <Route path="/opd" element={<ProtectedRoute><EncounterListPage /></ProtectedRoute>} />
        <Route path="/opd/new" element={<ProtectedRoute><NewEncounterPage /></ProtectedRoute>} />
        <Route path="/opd/:encounterId" element={<ProtectedRoute><EncounterDetailPage /></ProtectedRoute>} />
        <Route path="/opd/:encounterId/triage" element={<ProtectedRoute><TriagePage /></ProtectedRoute>} />

        {/* Billing */}
        <Route path="/billing" element={<Navigate to="/billing/invoices" replace />} />
        <Route path="/billing/invoices" element={<ProtectedRoute><InvoiceListPage /></ProtectedRoute>} />
        <Route path="/billing/invoices/new" element={<ProtectedRoute><CreateInvoicePage /></ProtectedRoute>} />
        <Route path="/billing/invoices/:id" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />

        {/* Lab */}
        <Route path="/lab" element={<Navigate to="/lab/orders" replace />} />
        <Route path="/lab/orders" element={<ProtectedRoute><LabOrderListPage /></ProtectedRoute>} />
        <Route path="/lab/orders/new" element={<ProtectedRoute><NewLabOrderPage /></ProtectedRoute>} />
        <Route path="/lab/orders/:id" element={<ProtectedRoute><LabOrderDetailPage /></ProtectedRoute>} />

        {/* Pharmacy */}
        <Route path="/pharmacy" element={<Navigate to="/pharmacy/drugs" replace />} />
        <Route path="/pharmacy/drugs" element={<ProtectedRoute><DrugListPage /></ProtectedRoute>} />
        <Route path="/pharmacy/prescriptions" element={<ProtectedRoute><PrescriptionQueuePage /></ProtectedRoute>} />
        <Route path="/pharmacy/prescriptions/:id/dispense" element={<ProtectedRoute><DispensePage /></ProtectedRoute>} />

        {/* IPD */}
        <Route path="/ipd" element={<ProtectedRoute><WardViewPage /></ProtectedRoute>} />
        <Route path="/ipd/admit" element={<ProtectedRoute><AdmitPatientPage /></ProtectedRoute>} />
        <Route path="/ipd/:admissionId" element={<ProtectedRoute><AdmissionDetailPage /></ProtectedRoute>} />

        {/* Nursing */}
        <Route path="/nursing" element={<ProtectedRoute><NursingStationPage /></ProtectedRoute>} />
        <Route path="/nursing/vitals" element={<ProtectedRoute><RecordVitalsPage /></ProtectedRoute>} />
        <Route path="/nursing/mar" element={<ProtectedRoute><MARPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/users" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
