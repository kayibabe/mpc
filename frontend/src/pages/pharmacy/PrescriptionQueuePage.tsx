import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { pharmacyApi } from '../../api/pharmacy'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  partially_dispensed: 'bg-blue-100 text-blue-700',
  dispensed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function PrescriptionQueuePage() {
  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescriptions', 'pending'],
    queryFn: () =>
      pharmacyApi.listPrescriptions({ status: 'pending' }).then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pharmacy — Prescription Queue</h1>
        <Link to="/pharmacy/drugs" className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Drug Inventory
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Prescribed</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && prescriptions?.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No pending prescriptions</td></tr>
            )}
            {prescriptions?.map((rx) => (
              <tr key={rx.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{rx.patient_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-gray-700">{rx.items.length} item{rx.items.length !== 1 ? 's' : ''}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[rx.status] ?? ''}`}>
                    {rx.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(rx.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link to={`/pharmacy/prescriptions/${rx.id}/dispense`} className="text-blue-600 hover:underline text-xs font-medium">
                    Dispense
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
