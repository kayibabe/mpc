import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { labApi, type LabResultCreate } from '../../api/lab'
import { useAuthStore } from '../../store/auth'
import { ArrowLeft } from 'lucide-react'

const STATUS_NEXT: Record<string, string> = {
  pending: 'sample_collected',
  sample_collected: 'processing',
  processing: 'resulted',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sample_collected: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  resulted: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function LabOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [resultForms, setResultForms] = useState<Record<string, Partial<LabResultCreate>>>({})

  const { data: order, isLoading } = useQuery({
    queryKey: ['lab-order', id],
    queryFn: () => labApi.getOrder(id!).then((r) => r.data),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => labApi.updateOrderStatus(id!, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-order', id] }),
  })

  const resultMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: LabResultCreate }) =>
      labApi.recordResult(id!, itemId, data),
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['lab-order', id] })
      setResultForms((prev) => { const n = { ...prev }; delete n[itemId]; return n })
    },
  })

  const isLabTech = user?.role === 'lab_tech' || user?.role === 'admin'

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
  if (!order) return <div className="py-12 text-center text-gray-500 text-sm">Order not found.</div>

  const nextStatus = STATUS_NEXT[order.status]

  return (
    <div>
      <Link to="/lab/orders" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to Lab Orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Lab Order</h1>
          <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[order.status] ?? ''}`}>
            {order.status.replace('_', ' ')}
          </span>
          {isLabTech && nextStatus && (
            <button
              onClick={() => statusMutation.mutate(nextStatus)}
              disabled={statusMutation.isPending}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Mark: {nextStatus.replace('_', ' ')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {order.items.map((item) => {
          const form = resultForms[item.id] ?? {}
          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.test_id}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? ''}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                {isLabTech && item.status !== 'resulted' && order.status === 'processing' && (
                  <button
                    onClick={() => setResultForms((prev) => ({ ...prev, [item.id]: {} }))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Enter result
                  </button>
                )}
              </div>

              {item.result && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${item.result.is_abnormal ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="font-medium">
                    {item.result.result_value} {item.result.result_unit}
                    {item.result.is_abnormal && <span className="ml-2 text-red-600 text-xs font-bold">ABNORMAL</span>}
                  </p>
                  {item.result.reference_range && <p className="text-xs text-gray-500">Ref: {item.result.reference_range}</p>}
                  {item.result.notes && <p className="text-xs text-gray-600 mt-1">{item.result.notes}</p>}
                </div>
              )}

              {resultForms[item.id] !== undefined && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Result value"
                      value={form.result_value ?? ''}
                      onChange={(e) => setResultForms((p) => ({ ...p, [item.id]: { ...p[item.id], result_value: e.target.value } }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={form.result_unit ?? ''}
                      onChange={(e) => setResultForms((p) => ({ ...p, [item.id]: { ...p[item.id], result_unit: e.target.value } }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Ref range"
                      value={form.reference_range ?? ''}
                      onChange={(e) => setResultForms((p) => ({ ...p, [item.id]: { ...p[item.id], reference_range: e.target.value } }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_abnormal ?? false}
                      onChange={(e) => setResultForms((p) => ({ ...p, [item.id]: { ...p[item.id], is_abnormal: e.target.checked } }))}
                      className="rounded text-red-600"
                    />
                    Flag as abnormal
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resultMutation.mutate({ itemId: item.id, data: form as LabResultCreate })}
                      disabled={resultMutation.isPending || !form.result_value}
                      className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setResultForms((p) => { const n = { ...p }; delete n[item.id]; return n })}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
