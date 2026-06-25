import client from './client'

export type LabOrderStatus = 'ordered' | 'sample_collected' | 'processing' | 'resulted' | 'verified' | 'cancelled'
export type LabPriority = 'routine' | 'urgent' | 'stat'
export type ResultFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high'

export interface LabTest {
  id: string
  name: string
  code: string
  category: string
  sample_type: string
  unit: string | null
  normal_range_text: string | null
  turnaround_hours: number
  price: number
  is_active: boolean
}

export interface LabOrderItem {
  id: string
  lab_order_id: string
  test_id: string
  sample_type: string | null
  result_value: string | null
  result_unit: string | null
  reference_range: string | null
  result_flag: ResultFlag | null
  resulted_at: string | null
  verified_at: string | null
  notes: string | null
}

export interface LabOrder {
  id: string
  encounter_id: string
  patient_id: string
  ordered_by_id: string
  order_date: string
  status: LabOrderStatus
  priority: LabPriority
  notes: string | null
  created_at: string
  updated_at: string
  items: LabOrderItem[]
}

export interface LabOrderCreate {
  encounter_id: string
  patient_id: string
  priority?: LabPriority
  notes?: string
  items: { test_id: string; priority?: LabPriority; notes?: string }[]
}

export interface LabResultCreate {
  result_value: string
  result_unit?: string
  reference_range?: string
  result_flag?: ResultFlag
  notes?: string
}

export const labApi = {
  listTests: (params?: { category?: string }) => client.get<LabTest[]>('/lab/tests', { params }),
  createTest: (data: Omit<LabTest, 'id' | 'is_active'>) => client.post<LabTest>('/lab/tests', data),
  listOrders: (params?: { patient_id?: string; encounter_id?: string; status?: string }) =>
    client.get<LabOrder[]>('/lab/orders', { params }),
  createOrder: (data: LabOrderCreate) => client.post<LabOrder>('/lab/orders', data),
  getOrder: (id: string) => client.get<LabOrder>(`/lab/orders/${id}`),
  updateStatus: (id: string, status: LabOrderStatus) =>
    client.put<LabOrder>(`/lab/orders/${id}/status`, { status }),
  recordResult: (orderId: string, itemId: string, data: LabResultCreate) =>
    client.post<LabOrderItem>(`/lab/orders/${orderId}/results/${itemId}`, data),
}
