import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { admissionsApi } from '../../api/admissions'
import { Plus } from 'lucide-react'

export default function WardViewPage() {
  const { data: wards, isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: () => admissionsApi.listWards().then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">IPD — Ward View</h1>
        <Link
          to="/ipd/admit"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Admit Patient
        </Link>
      </div>

      {isLoading && <p className="text-gray-400 text-sm">Loading wards…</p>}

      <div className="space-y-6">
        {wards?.map((ward) => {
          const total = ward.beds.length
          const occupied = ward.beds.filter((b: { status: string }) => b.status === 'occupied').length
          const pct = total > 0 ? Math.round((occupied / total) * 100) : 0
          return (
            <div key={ward.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-800">{ward.name}</h2>
                  <p className="text-xs text-gray-500 capitalize">{ward.ward_type}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-gray-700">{occupied}/{total} occupied</p>
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-400' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {ward.beds.map((bed: { id: string; bed_number: string; status: string; current_admission_id?: string }) => (
                  <div
                    key={bed.id}
                    title={`Bed ${bed.bed_number} — ${bed.status}`}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      bed.status === 'occupied'
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : bed.status === 'maintenance'
                        ? 'bg-gray-100 border-gray-300 text-gray-400'
                        : 'bg-green-100 border-green-300 text-green-700'
                    }`}
                  >
                    {bed.current_admission_id ? (
                      <Link to={`/ipd/${bed.current_admission_id}`} className="w-full h-full flex items-center justify-center">
                        {bed.bed_number}
                      </Link>
                    ) : (
                      bed.bed_number
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-300 inline-block" /> Available</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-300 inline-block" /> Occupied</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 border border-gray-300 inline-block" /> Maintenance</span>
              </div>
            </div>
          )
        })}
        {!isLoading && wards?.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-12">No wards configured. Contact admin.</p>
        )}
      </div>
    </div>
  )
}
