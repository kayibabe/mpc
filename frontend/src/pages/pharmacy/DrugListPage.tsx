import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { pharmacyApi } from '../../api/pharmacy'
import { AlertTriangle } from 'lucide-react'

export default function DrugListPage() {
  const [search, setSearch] = useState('')

  const { data: drugs, isLoading } = useQuery({
    queryKey: ['drugs', search],
    queryFn: () => pharmacyApi.listDrugs(search || undefined).then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pharmacy — Drug Inventory</h1>
        <Link to="/pharmacy/prescriptions" className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Prescription Queue
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search drugs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Drug Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Generic</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Form</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Strength</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && drugs?.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No drugs found</td></tr>
            )}
            {drugs?.map((drug) => {
              const totalStock = drug.stock?.reduce((s: number, b: { quantity_remaining: number; expiry_date: string }) => s + b.quantity_remaining, 0) ?? 0
              const expiringSoon = drug.stock?.some((b: { expiry_date: string }) => {
                const days = (new Date(b.expiry_date).getTime() - Date.now()) / 86400000
                return days <= 30
              }) ?? false
              return (
                <tr key={drug.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{drug.name}</td>
                  <td className="px-4 py-3 text-gray-500">{drug.generic_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{drug.form}</td>
                  <td className="px-4 py-3 text-gray-600">{drug.strength ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${totalStock < 10 ? 'text-red-600' : 'text-gray-800'}`}>
                      {totalStock} {drug.unit}
                    </span>
                    {expiringSoon && (
                      <AlertTriangle size={12} className="inline ml-1 text-yellow-500" title="Batch expiring soon" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/pharmacy/drugs/${drug.id}`} className="text-blue-600 hover:underline text-xs">
                      Stock
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
