import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { labApi, type LabOrderCreate } from '../../api/lab'
import { patientsApi } from '../../api/patients'
import { useAuthStore } from '../../store/auth'

export default function NewLabOrderPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined).then((r) => r.data),
    enabled: search.length > 1,
  })

  const { data: tests } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => labApi.listTests().then((r) => r.data),
  })

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)

  const mutation = useMutation({
    mutationFn: (data: LabOrderCreate) => labApi.createOrder(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['lab-orders'] })
      navigate(`/lab/orders/${res.data.id}`)
    },
  })

  const toggleTest = (id: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId || selectedTests.size === 0) return
    mutation.mutate({
      patient_id: selectedPatientId,
      ordered_by: user!.id,
      items: Array.from(selectedTests).map((id) => ({ test_id: id, priority: 'routine' })),
    })
  }

  const byCategory = (tests ?? []).reduce<Record<string, typeof tests>>((acc, t) => {
    const cat = t!.category
    if (!acc[cat]) acc[cat] = []
    acc[cat]!.push(t!)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">New Lab Order</h1>
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-3">
            Select Tests <span className="text-gray-400 font-normal">({selectedTests.size} selected)</span>
          </h2>
          {Object.entries(byCategory).map(([cat, catTests]) => (
            <div key={cat} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
              <div className="grid grid-cols-2 gap-2">
                {catTests?.map((test) => (
                  <label key={test.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedTests.has(test.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedTests.has(test.id)}
                      onChange={() => toggleTest(test.id)}
                      className="rounded text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{test.name}</p>
                      {test.price && <p className="text-xs text-gray-400">MK {Number(test.price).toLocaleString()}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!tests?.length && <p className="text-sm text-gray-400 italic">No lab tests configured yet.</p>}
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to create lab order. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedPatientId || selectedTests.size === 0 || mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : `Order ${selectedTests.size} Test${selectedTests.size !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={() => navigate('/lab/orders')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
