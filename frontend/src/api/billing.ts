import client from './client'

export type InvoiceStatus = 'pending' | 'paid' | 'partial' | 'void'
export type PaymentMode = 'cash' | 'card' | 'mobile_money' | 'insurance' | 'other'
export type LineItemCategory = 'consultation' | 'lab' | 'pharmacy' | 'bed' | 'procedure' | 'other'

export interface LineItem {
  id: string
  description: string
  category: LineItemCategory
  quantity: number
  unit_price: number | string
  total_price: number | string
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number | string
  payment_mode: PaymentMode
  reference: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  patient_id: string
  encounter_id: string | null
  status: InvoiceStatus
  subtotal_amount: number | string
  total_amount: number | string
  amount_paid: number | string
  balance: number | string
  created_at: string
  updated_at: string
  line_items: LineItem[]
  payments: Payment[]
}

export interface LineItemCreate {
  description: string
  quantity: number
  unit_price: number
  category: LineItemCategory
}

export interface InvoiceCreate {
  patient_id: string
  encounter_id?: string
  line_items: LineItemCreate[]
}

export interface InvoiceUpdate {
  status?: InvoiceStatus
}

export interface PaymentCreate {
  invoice_id: string
  amount: number
  payment_mode: PaymentMode
  reference?: string
}

export interface BillingSummary {
  total_invoiced?: number
  total_paid?: number
  total_outstanding?: number
  invoice_count?: number
  by_payment_mode?: Record<string, number>
}

export const billingApi = {
  listInvoices: (params?: { patient_id?: string; status?: string; date_from?: string; date_to?: string }) =>
    client.get<Invoice[]>('/billing/invoices', { params }),
  createInvoice: (data: InvoiceCreate) => client.post<Invoice>('/billing/invoices', data),
  getInvoice: (id: string) => client.get<Invoice>(`/billing/invoices/${id}`),
  updateInvoice: (id: string, data: InvoiceUpdate) =>
    client.put<Invoice>(`/billing/invoices/${id}`, data),
  recordPayment: (invoiceId: string, data: PaymentCreate) =>
    client.post<Payment>(`/billing/invoices/${invoiceId}/payments`, data),
  getSummary: (params?: { date_from?: string; date_to?: string }) =>
    client.get<BillingSummary>('/billing/summary', { params }),
}
