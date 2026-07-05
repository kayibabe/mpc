import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pharmacyApi, type DispenseCreate } from '../../api/pharmacy'
import { ArrowLeft } from 'lucide-react'

export default function DispensePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: rx, isLoading } = useQuery({
    queryKey: ['prescription', id],
    queryFn: () => pharmacyApi.getPrescription(id!).then((r) => r.data),
    enabled: !!id,
  })

  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const mutation = useMutation({
    mutationFn: (data: DispenseCreate) => pharmacyApi.dispense(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] })
      navigate('/pharmacy/prescriptions')
    },
  })

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
  if (!rx) return <div className="py-12 text-center text-gray-500 text-sm">Prescription not found.</div>

  const handleDispense = () => {
    const items = rx.items
      .filter((item) => (quantities[item.id] ?? item.quantity) > 0)
      .map((item) => ({
        prescription_item_id: item.id,
        quantity_dispensed: quantities[item.id] ?? item.quantity,
      }))
    mutation.mutate({ prescription_id: id!, items })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/pharmacy/prescriptions" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to Queue
      </Link>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dispense Prescription</h1>
      <p className="text-sm text-gray-500 mb-6">
        Patient: <span className="font-mono">{rx.patient_id.slice(0, 8)}…</span>
        &nbsp;·&nbsp;{new Date(rx.created_at).toLocaleString()}
      </p>

      <div className="space-y-3 mb-6">
        {rx.items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-800">{item.drug_id}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Dose: {item.dose} · {item.frequency} · {item.duration}
                </p>
                {item.instructions && (
                  <p className="text-xs text-gray-400 italic mt-1">{item.instructions}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Prescribed qty</p>
                <p className="font-bold text-gray-700">{item.quantity}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-gray-500 shrink-0">Dispense qty:</label>
              <input
                type="number"
                min={0}
                max={item.quantity}
                value={quantities[item.id] ?? item.quantity}
                onChange={(e) => setQuantities((p) => ({ ...p, [item.id]: Number(e.target.value) }))}
                className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      {mutation.isError && (
        <p className="text-red-600 text-sm mb-3">Failed to dispense. Check stock availability.</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDispense}
          disabled={mutation.isPending}
          className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {mutation.isPending ? 'Dispensing…' : 'Confirm Dispense'}
        </button>
        <button
          onClick={() => navigate('/pharmacy/prescriptions')}
          className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
