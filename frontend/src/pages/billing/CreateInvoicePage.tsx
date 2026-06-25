import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi, type LineItemCreate, type InvoiceCreate } from '../../api/billing'
import { patientsApi } from '../../api/patients'
import { Plus, Trash2 } from 'lucide-react'

const CATEGORIES = ['consultation', 'lab', 'pharmacy', 'bed', 'procedure', 'other'] as const

const EMPTY_LINE: LineItemCreate = { description: '', quantity: 1, unit_price: 0, category: 'consultation' }

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineItemCreate[]>([{ ...EMPTY_LINE }])

  const { data: patients } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined).then((r) => r.data),
    enabled: search.length > 1,
  })

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)

  const mutation = useMutation({
    mutationFn: (data: InvoiceCreate) => billingApi.createInvoice(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/billing/invoices/${res.data.id}`)
    },
  })

  const updateLine = (i: number, patch: Partial<LineItemCreate>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId) return
    mutation.mutate({ patient_id: selectedPatientId, line_items: lines })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">New Invoice</h1>
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
          <h2 className="font-semibold text-gray-700 mb-4">Line Items</h2>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  required
                  type="text"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={line.category}
                  onChange={(e) => updateLine(i, { category: e.target.value as LineItemCreate['category'] })}
                  className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Qty"
                />
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                  className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Unit price"
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                  className="col-span-1 p-2 text-red-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
            className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
          >
            <Plus size={14} /> Add line
          </button>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
            <div className="text-sm space-y-1">
              <div className="flex justify-between gap-12 text-gray-600">
                <span>Subtotal</span>
                <span>MK {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-12 font-bold text-gray-800 text-base">
                <span>Total</span>
                <span>MK {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to create invoice. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedPatientId || mutation.isPending}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Invoice'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/billing/invoices')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
