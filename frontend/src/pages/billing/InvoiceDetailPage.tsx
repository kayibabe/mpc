import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi, type PaymentCreate } from '../../api/billing'
import { ArrowLeft } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  void: 'bg-gray-100 text-gray-400',
}

const PAYMENT_MODES = ['cash', 'card', 'mobile_money', 'insurance', 'other'] as const

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState<PaymentCreate>({
    invoice_id: id!,
    amount: 0,
    payment_mode: 'cash',
    reference: '',
  })

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => billingApi.getInvoice(id!).then((r) => r.data),
    enabled: !!id,
  })

  const payMutation = useMutation({
    mutationFn: (data: PaymentCreate) => billingApi.recordPayment(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setShowPayForm(false)
      setPayForm({ invoice_id: id!, amount: 0, payment_mode: 'cash', reference: '' })
    },
  })

  const voidMutation = useMutation({
    mutationFn: () => billingApi.updateInvoice(id!, { status: 'void' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
  if (!invoice) return <div className="py-12 text-center text-gray-500 text-sm">Invoice not found.</div>

  return (
    <div>
      <Link to="/billing/invoices" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to Invoices
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Invoice {invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500">{new Date(invoice.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[invoice.status] ?? ''}`}>
            {invoice.status}
          </span>
          {invoice.status !== 'void' && invoice.status !== 'paid' && (
            <>
              <button
                onClick={() => setShowPayForm((v) => !v)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
              >
                Record Payment
              </button>
              <button
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
                className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm disabled:opacity-50"
              >
                Void
              </button>
            </>
          )}
        </div>
      </div>

      {showPayForm && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="font-semibold text-green-800 mb-3">Record Payment</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Amount (MK)</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={Number(invoice.balance)}
                value={payForm.amount || ''}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Mode</label>
              <select
                value={payForm.payment_mode}
                onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value as typeof payForm.payment_mode })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Reference</label>
              <input
                type="text"
                value={payForm.reference ?? ''}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Receipt / txn ID"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => payMutation.mutate(payForm)}
              disabled={payMutation.isPending || payForm.amount <= 0}
              className="px-4 py-1.5 bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {payMutation.isPending ? 'Saving…' : 'Save Payment'}
            </button>
            <button onClick={() => setShowPayForm(false)} className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-700 mb-3">Line Items</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit Price</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.line_items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2 capitalize text-gray-500">{item.category}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">MK {Number(item.unit_price).toLocaleString()}</td>
                <td className="py-2 text-right font-medium">MK {Number(item.total_price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr>
              <td colSpan={4} className="pt-3 text-right font-bold text-gray-700">Total</td>
              <td className="pt-3 text-right font-bold text-gray-800">MK {Number(invoice.total_amount).toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right text-green-700">Paid</td>
              <td className="text-right text-green-700">MK {Number(invoice.amount_paid).toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right font-bold text-red-600">Balance</td>
              <td className="text-right font-bold text-red-600">MK {Number(invoice.balance).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Payment History</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">No payments recorded</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Mode</th>
                <th className="pb-2 font-medium">Reference</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.payments.map((pay) => (
                <tr key={pay.id}>
                  <td className="py-2 text-gray-500 text-xs">{new Date(pay.created_at).toLocaleString()}</td>
                  <td className="py-2 capitalize">{pay.payment_mode.replace('_', ' ')}</td>
                  <td className="py-2 text-gray-500">{pay.reference ?? '—'}</td>
                  <td className="py-2 text-right font-medium text-green-700">MK {Number(pay.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
