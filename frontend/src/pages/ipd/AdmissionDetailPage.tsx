import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { admissionsApi, type DischargeCreate } from '../../api/admissions'
import { useAuthStore } from '../../store/auth'
import { ArrowLeft } from 'lucide-react'

export default function AdmissionDetailPage() {
  const { admissionId } = useParams<{ admissionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [showDischargeForm, setShowDischargeForm] = useState(false)
  const [dischargeForm, setDischargeForm] = useState<DischargeCreate>({
    discharge_type: 'home',
    discharge_diagnosis: '',
    notes: '',
  })

  const { data: admission, isLoading } = useQuery({
    queryKey: ['admission', admissionId],
    queryFn: () => admissionsApi.getAdmission(admissionId!).then((r) => r.data),
    enabled: !!admissionId,
  })

  const dischargeMutation = useMutation({
    mutationFn: (data: DischargeCreate) => admissionsApi.discharge(admissionId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admission', admissionId] })
      qc.invalidateQueries({ queryKey: ['wards'] })
      navigate('/ipd')
    },
  })

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin'

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
  if (!admission) return <div className="py-12 text-center text-gray-500 text-sm">Admission not found.</div>

  return (
    <div>
      <Link to="/ipd" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to Wards
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Admission Detail</h1>
          <p className="text-sm text-gray-500">Admitted {new Date(admission.admitted_at).toLocaleString()}</p>
        </div>
        {admission.status === 'active' && isDoctor && (
          <button
            onClick={() => setShowDischargeForm((v) => !v)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium"
          >
            Discharge Patient
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Patient Info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Patient ID</dt><dd className="font-mono text-xs">{admission.patient_id}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium capitalize">{admission.status}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Diagnosis</dt><dd className="font-medium max-w-xs text-right">{admission.diagnosis ?? '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Bed</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Ward</dt><dd className="font-medium">{admission.ward_id}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Bed</dt><dd className="font-medium">{admission.bed_id}</dd></div>
            {admission.discharged_at && (
              <div className="flex justify-between"><dt className="text-gray-500">Discharged</dt><dd className="font-medium">{new Date(admission.discharged_at).toLocaleString()}</dd></div>
            )}
          </dl>
        </div>
      </div>

      {showDischargeForm && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-orange-800">Discharge Patient</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Discharge Type</label>
              <select
                value={dischargeForm.discharge_type}
                onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_type: e.target.value as DischargeCreate['discharge_type'] })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="home">Home</option>
                <option value="referred">Referred</option>
                <option value="ama">AMA</option>
                <option value="deceased">Deceased</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Discharge Diagnosis</label>
              <input
                type="text"
                value={dischargeForm.discharge_diagnosis ?? ''}
                onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_diagnosis: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <textarea
                rows={2}
                value={dischargeForm.notes ?? ''}
                onChange={(e) => setDischargeForm({ ...dischargeForm, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => dischargeMutation.mutate(dischargeForm)}
              disabled={dischargeMutation.isPending}
              className="px-4 py-1.5 bg-orange-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {dischargeMutation.isPending ? 'Discharging…' : 'Confirm Discharge'}
            </button>
            <button onClick={() => setShowDischargeForm(false)} className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
