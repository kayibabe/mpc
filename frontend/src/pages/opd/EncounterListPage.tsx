import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { encountersApi } from '../../api/encounters'
import { Plus } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  referred: 'bg-yellow-100 text-yellow-700',
}

export default function EncounterListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const today = new Date().toISOString().slice(0, 10)

  const { data: encounters, isLoading } = useQuery({
    queryKey: ['encounters', statusFilter, today],
    queryFn: () =>
      encountersApi
        .list({ status: statusFilter || undefined, encounter_date: today })
        .then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">OPD — Today's Queue</h1>
        <Link
          to="/opd/new"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New Encounter
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'open', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Complaint</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && encounters?.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No encounters found</td></tr>
            )}
            {encounters?.map((enc) => (
              <tr key={enc.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{enc.patient_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 capitalize text-gray-700">{enc.encounter_type}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{enc.chief_complaint ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(enc.encounter_date).toLocaleTimeString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[enc.status] ?? ''}`}>
                    {enc.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/opd/${enc.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
