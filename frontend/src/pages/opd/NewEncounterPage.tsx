import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { encountersApi, type EncounterCreate } from '../../api/encounters'
import { patientsApi } from '../../api/patients'

export default function NewEncounterPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EncounterCreate, 'patient_id'>>({
    encounter_type: 'opd',
    chief_complaint: '',
    department: '',
  })

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined).then((r) => r.data),
    enabled: search.length > 1,
  })

  const mutation = useMutation({
    mutationFn: (data: EncounterCreate) => encountersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['encounters'] })
      navigate(`/opd/${res.data.id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId) return
    mutation.mutate({ ...form, patient_id: selectedPatientId })
  }

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">New Encounter</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Select Patient</h2>
          <input
            type="text"
            placeholder="Search by name, MRN, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {patients && patients.length > 0 && !selectedPatientId && (
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
          {selectedPatient && (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2">
              <span className="text-sm font-medium text-blue-800">
                {selectedPatient.last_name}, {selectedPatient.first_name}
                <span className="font-mono ml-2 text-xs text-blue-600">{selectedPatient.mrn}</span>
              </span>
              <button type="button" onClick={() => setSelectedPatientId(null)} className="text-xs text-blue-500 hover:text-blue-700">
                Change
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Encounter Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={form.encounter_type}
                onChange={(e) => setForm({ ...form, encounter_type: e.target.value as 'opd' | 'ipd' | 'emergency' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="opd">OPD</option>
                <option value="ipd">IPD</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <input
                type="text"
                value={form.department ?? ''}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. General Medicine"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Chief Complaint</label>
              <textarea
                rows={3}
                value={form.chief_complaint ?? ''}
                onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Patient's presenting complaint…"
              />
            </div>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to create encounter. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedPatientId || mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Encounter'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/opd')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
