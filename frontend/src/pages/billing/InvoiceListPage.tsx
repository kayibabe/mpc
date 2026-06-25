import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { billingApi } from '../../api/billing'
import { Plus } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  void: 'bg-gray-100 text-gray-400 line-through',
}

export default function InvoiceListPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter, dateFrom],
    queryFn: () =>
      billingApi
        .listInvoices({ status: statusFilter || undefined, date_from: dateFrom || undefined })
        .then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Billing — Invoices</h1>
        <Link
          to="/billing/invoices/new"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New Invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1">
          {['', 'pending', 'partial', 'paid', 'void'].map((s) => (
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
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="From date"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && invoices?.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No invoices found</td></tr>
            )}
            {invoices?.map((inv) => (
              <tr key={inv.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-gray-700 font-mono text-xs">{inv.patient_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-right font-medium">MK {Number(inv.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-700">MK {Number(inv.amount_paid).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-600">MK {Number(inv.balance).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? ''}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link to={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
