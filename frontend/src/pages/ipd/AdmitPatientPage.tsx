import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { admissionsApi, type AdmissionCreate } from '../../api/admissions'
import { patientsApi } from '../../api/patients'

export default function AdmitPatientPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedWardId, setSelectedWardId] = useState('')
  const [selectedBedId, setSelectedBedId] = useState('')
  const [form, setForm] = useState({ diagnosis: '', notes: '' })

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined).then((r) => r.data),
    enabled: search.length > 1,
  })

  const { data: wards } = useQuery({
    queryKey: ['wards'],
    queryFn: () => admissionsApi.listWards().then((r) => r.data),
  })

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)
  const selectedWard = wards?.find((w) => w.id === selectedWardId)
  const availableBeds = selectedWard?.beds.filter((b: { status: string }) => b.status === 'available') ?? []

  const mutation = useMutation({
    mutationFn: (data: AdmissionCreate) => admissionsApi.admit(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['wards'] })
      qc.invalidateQueries({ queryKey: ['admissions'] })
      navigate(`/ipd/${res.data.id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId || !selectedWardId || !selectedBedId) return
    mutation.mutate({
      patient_id: selectedPatientId,
      ward_id: selectedWardId,
      bed_id: selectedBedId,
      ...form,
    })
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admit Patient</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Patient</h2>
          {!selectedPatientId ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2">
              <span className="text-sm font-medium text-blue-800">
                {selectedPatient?.last_name}, {selectedPatient?.first_name}
                <span className="font-mono ml-2 text-xs text-blue-600">{selectedPatient?.mrn}</span>
              </span>
              <button type="button" onClick={() => setSelectedPatientId(null)} className="text-xs text-blue-500 hover:text-blue-700">
                Change
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Bed Assignment</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ward</label>
              <select
                required
                value={selectedWardId}
                onChange={(e) => { setSelectedWardId(e.target.value); setSelectedBedId('') }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select ward…</option>
                {wards?.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bed</label>
              <select
                required
                value={selectedBedId}
                onChange={(e) => setSelectedBedId(e.target.value)}
                disabled={!selectedWardId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">Select bed…</option>
                {availableBeds.map((b: { id: string; bed_number: string; bed_type: string }) => (
                  <option key={b.id} value={b.id}>
                    Bed {b.bed_number} ({b.bed_type})
                  </option>
                ))}
              </select>
              {selectedWardId && availableBeds.length === 0 && (
                <p className="text-xs text-red-600 mt-1">No available beds in this ward</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Clinical Info</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Diagnosis</label>
            <input
              type="text"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Admitting diagnosis"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to admit patient. Bed may already be occupied.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedPatientId || !selectedBedId || mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Admitting…' : 'Admit Patient'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/ipd')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
