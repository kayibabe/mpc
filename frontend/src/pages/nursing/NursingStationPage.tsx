import { useQuery } from '@tanstack/react-query'
import { nursingApi } from '../../api/nursing'
import { Link } from 'react-router-dom'

export default function NursingStationPage() {
  const { data: vitals, isLoading } = useQuery({
    queryKey: ['vitals-recent'],
    queryFn: () => nursingApi.listVitals({}).then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nursing Station</h1>
        <div className="flex gap-2">
          <Link to="/nursing/vitals" className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Record Vitals
          </Link>
          <Link to="/nursing/mar" className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            MAR
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">Recent Vitals</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">BP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pulse</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Temp</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SpO₂</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && vitals?.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No vitals recorded yet</td></tr>
            )}
            {vitals?.map((v) => (
              <tr key={v.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.patient_id.slice(0, 8)}…</td>
                <td className="px-4 py-3">
                  {v.bp_systolic && v.bp_diastolic
                    ? <span className={`font-medium ${(v.bp_systolic > 140 || v.bp_systolic < 90) ? 'text-red-600' : 'text-gray-700'}`}>
                        {v.bp_systolic}/{v.bp_diastolic}
                      </span>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {v.pulse
                    ? <span className={`font-medium ${(v.pulse > 100 || v.pulse < 60) ? 'text-yellow-600' : 'text-gray-700'}`}>
                        {v.pulse} bpm
                      </span>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {v.temperature
                    ? <span className={`font-medium ${v.temperature > 37.5 ? 'text-red-600' : 'text-gray-700'}`}>
                        {v.temperature}°C
                      </span>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {v.spo2
                    ? <span className={`font-medium ${v.spo2 < 95 ? 'text-red-600' : 'text-gray-700'}`}>
                        {v.spo2}%
                      </span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(v.recorded_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
