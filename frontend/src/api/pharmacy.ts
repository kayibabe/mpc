import client from './client'

export type DrugForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'drops' | 'inhaler' | 'suppository' | 'patch' | 'other'
export type PrescriptionStatus = 'pending' | 'dispensed' | 'partially_dispensed' | 'cancelled'

export interface DrugStockBatch {
  id: string
  drug_id: string
  batch_number: string | null
  expiry_date: string
  quantity_remaining: number
  purchase_price: number | null
  supplier: string | null
}

export interface Drug {
  id: string
  name: string
  generic_name: string | null
  form: DrugForm
  strength: string | null
  unit: string
  is_active: boolean
  price: number | null
  stock?: DrugStockBatch[]
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  drug_id: string
  dose: string
  frequency: string
  duration: string | null
  quantity: number
  instructions: string | null
}

export interface Prescription {
  id: string
  patient_id: string
  encounter_id: string | null
  status: PrescriptionStatus
  created_at: string
  items: PrescriptionItem[]
}

export interface DispenseItemCreate {
  prescription_item_id: string
  quantity_dispensed: number
}

export interface DispenseCreate {
  prescription_id: string
  items: DispenseItemCreate[]
}

export const pharmacyApi = {
  listDrugs: (q?: string) =>
    client.get<Drug[]>('/pharmacy/drugs', { params: q ? { q } : undefined }),
  getDrugStock: (drugId: string) => client.get<DrugStockBatch[]>(`/pharmacy/drugs/${drugId}/stock`),
  addStock: (drugId: string, data: { quantity_received: number; expiry_date: string; batch_number?: string; supplier?: string; purchase_price?: number }) =>
    client.post<DrugStockBatch>(`/pharmacy/drugs/${drugId}/stock`, data),
  listPrescriptions: (params?: { patient_id?: string; status?: string }) =>
    client.get<Prescription[]>('/pharmacy/prescriptions', { params }),
  getPrescription: (id: string) => client.get<Prescription>(`/pharmacy/prescriptions/${id}`),
  dispense: (id: string, data: DispenseCreate) =>
    client.post<Prescription>(`/pharmacy/prescriptions/${id}/dispense`, data),
}
