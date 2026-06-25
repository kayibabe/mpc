import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { nursingApi, type MARCreate } from '../../api/nursing'
import { useAuthStore } from '../../store/auth'
import { Link } from 'react-router-dom'

export default function MARPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MARCreate>({
    prescription_item_id: '',
    administered_by: user?.id ?? '',
    administered_at: new Date().toISOString().slice(0, 16),
    dose_given: '',
    route: 'oral',
    notes: '',
  })

  const { data: records, isLoading } = useQuery({
    queryKey: ['mar'],
    queryFn: () => nursingApi.listMAR({}).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: MARCreate) => nursingApi.recordMAR(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mar'] })
      setShowForm(false)
      setForm({ prescription_item_id: '', administered_by: user?.id ?? '', administered_at: new Date().toISOString().slice(0, 16), dose_given: '', route: 'oral', notes: '' })
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Medication Administration Record</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Record Administration
          </button>
          <Link to="/nursing" className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Station
          </Link>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-blue-800">Record Administration</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Prescription Item ID</label>
              <input
                type="text"
                value={form.prescription_item_id}
                onChange={(e) => setForm({ ...form, prescription_item_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Item UUID"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Administered At</label>
              <input
                type="datetime-local"
                value={form.administered_at}
                onChange={(e) => setForm({ ...form, administered_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Dose Given</label>
              <input
                type="text"
                value={form.dose_given}
                onChange={(e) => setForm({ ...form, dose_given: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. 500mg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Route</label>
              <select
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {['oral', 'iv', 'im', 'sc', 'topical', 'inhaled', 'other'].map((r) => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending || !form.prescription_item_id || !form.dose_given}
              className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dose</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Route</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Administered At</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && records?.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No records found</td></tr>
            )}
            {records?.map((rec) => (
              <tr key={rec.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{rec.prescription_item_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-medium text-gray-700">{rec.dose_given}</td>
                <td className="px-4 py-3 uppercase text-xs text-gray-500">{rec.route}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(rec.administered_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{rec.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
