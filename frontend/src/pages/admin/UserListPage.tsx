import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { UserPlus } from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  doctor: 'bg-blue-100 text-blue-700',
  nurse: 'bg-purple-100 text-purple-700',
  receptionist: 'bg-green-100 text-green-700',
  lab_tech: 'bg-yellow-100 text-yellow-700',
  pharmacist: 'bg-orange-100 text-orange-700',
  billing_clerk: 'bg-indigo-100 text-indigo-700',
}

export default function UserListPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', full_name: '', password: '', role: 'nurse', department: '' })

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => authApi.register(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowForm(false)
      setForm({ employee_id: '', full_name: '', password: '', role: 'nurse', department: '' })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      authApi.updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Admin — Users</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {showForm && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-blue-800">New Staff Account</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Employee ID</label>
              <input
                required
                type="text"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Full Name</label>
              <input
                required
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Object.keys(ROLE_BADGE).map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Nursing"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Temporary Password</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          {createMutation.isError && <p className="text-red-600 text-sm">Failed to create user.</p>}
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Account'}
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.employee_id}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? ''}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.department ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                    disabled={toggleMutation.isPending}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
