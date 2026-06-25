import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { labApi } from '../../api/lab'
import { Plus } from 'lucide-react'

const STATUS_STEPS = ['pending', 'sample_collected', 'processing', 'resulted', 'cancelled']

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sample_collected: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  resulted: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function LabOrderListPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data: orders, isLoading } = useQuery({
    queryKey: ['lab-orders', statusFilter],
    queryFn: () =>
      labApi.listOrders({ status: statusFilter || undefined }).then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Laboratory — Orders</h1>
        <Link
          to="/lab/orders/new"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New Order
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {['', ...STATUS_STEPS].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tests</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ordered</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && orders?.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No orders found</td></tr>
            )}
            {orders?.map((order) => (
              <tr key={order.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.patient_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-gray-700">{order.items.length} test{order.items.length !== 1 ? 's' : ''}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status] ?? ''}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link to={`/lab/orders/${order.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
