import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nursingApi, type VitalSignsCreate } from '../../api/nursing'
import { patientsApi } from '../../api/patients'

export default function RecordVitalsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const prefillPatientId = searchParams.get('patient_id')
  const prefillEncounterId = searchParams.get('encounter_id')
  const prefillAdmissionId = searchParams.get('admission_id')

  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(prefillPatientId)
  const [form, setForm] = useState<Omit<VitalSignsCreate, 'patient_id'>>({
    bp_systolic: undefined,
    bp_diastolic: undefined,
    pulse: undefined,
    temperature: undefined,
    spo2: undefined,
    weight: undefined,
    height: undefined,
    respiratory_rate: undefined,
    encounter_id: prefillEncounterId ?? undefined,
    admission_id: prefillAdmissionId ?? undefined,
  })

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined).then((r) => r.data),
    enabled: search.length > 1 && !selectedPatientId,
  })

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)

  const mutation = useMutation({
    mutationFn: (data: VitalSignsCreate) => nursingApi.recordVitals(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals-recent'] })
      navigate('/nursing')
    },
  })

  const num = (key: keyof typeof form, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? undefined : Number(e.target.value)
    setForm({ ...form, [key]: v })
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Record Vitals</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (!selectedPatientId) return; mutation.mutate({ ...form, patient_id: selectedPatientId }) }} className="space-y-4">
        {!selectedPatientId ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">Patient</h2>
            <input
              type="text"
              placeholder="Search by name, MRN, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {patients && patients.length > 0 && (
              <ul className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {patients.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedPatientId(p.id); setSearch('') }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                    >
                      <span className="font-medium">{p.last_name}, {p.first_name}</span>
                      <span className="text-gray-500 ml-2 font-mono text-xs">{p.mrn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-blue-800">
              {selectedPatient?.last_name}, {selectedPatient?.first_name}
              <span className="font-mono ml-2 text-xs text-blue-600">{selectedPatient?.mrn}</span>
            </span>
            {!prefillPatientId && (
              <button type="button" onClick={() => setSelectedPatientId(null)} className="text-xs text-blue-500 hover:text-blue-700">
                Change
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Vital Signs</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'BP Systolic (mmHg)', key: 'bp_systolic' as const },
              { label: 'BP Diastolic (mmHg)', key: 'bp_diastolic' as const },
              { label: 'Pulse (bpm)', key: 'pulse' as const },
              { label: 'SpO₂ (%)', key: 'spo2' as const },
              { label: 'Temperature (°C)', key: 'temperature' as const, step: '0.1' },
              { label: 'Resp. Rate (/min)', key: 'respiratory_rate' as const },
              { label: 'Weight (kg)', key: 'weight' as const, step: '0.1' },
              { label: 'Height (cm)', key: 'height' as const, step: '0.1' },
            ].map(({ label, key, step }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  step={step ?? '1'}
                  min={0}
                  value={(form[key] as number | undefined) ?? ''}
                  onChange={(e) => num(key, e)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to record vitals. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedPatientId || mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save Vitals'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/nursing')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
