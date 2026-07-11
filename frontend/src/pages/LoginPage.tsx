import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(employeeId, password)
      navigate('/')
    } catch {
      setError('Invalid employee ID or password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-800">MPC</h1>
          <p className="text-sm text-gray-500 mt-1">Mtowera Private Clinic</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. EMP001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
