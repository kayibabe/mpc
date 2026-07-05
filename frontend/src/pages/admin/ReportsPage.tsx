import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { billingApi } from '../../api/billing'

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['billing-summary', dateFrom, dateTo],
    queryFn: () =>
      billingApi.getSummary({ date_from: dateFrom, date_to: dateTo }).then((r) => r.data),
    enabled: !!dateFrom && !!dateTo,
  })

  const statCards = summary
    ? [
        { label: 'Total Invoiced', value: `MK ${Number(summary.total_invoiced ?? 0).toLocaleString()}`, color: 'text-blue-700' },
        { label: 'Total Collected', value: `MK ${Number(summary.total_paid ?? 0).toLocaleString()}`, color: 'text-green-700' },
        { label: 'Outstanding', value: `MK ${Number(summary.total_outstanding ?? 0).toLocaleString()}`, color: 'text-red-600' },
        { label: 'Invoices Issued', value: summary.invoice_count ?? '—', color: 'text-gray-700' },
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin — Revenue Reports</h1>

      <div className="flex gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading && <p className="text-gray-400 text-sm">Loading report…</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {statCards.map((c) => (
              <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {summary.by_payment_mode && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">By Payment Mode</h2>
              <div className="space-y-2">
                {Object.entries(summary.by_payment_mode as Record<string, number>).map(([mode, amount]) => (
                  <div key={mode} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{mode.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-800">MK {Number(amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
