import client from './client'

export type WardType = 'general' | 'maternity' | 'private' | 'icu' | 'pediatric'
export type BedStatus = 'available' | 'occupied' | 'maintenance'
export type AdmissionStatus = 'active' | 'discharged' | 'transferred'
export type DischargeType = 'home' | 'referred' | 'ama' | 'deceased'

export interface Bed {
  id: string
  ward_id: string
  bed_number: string
  bed_type: string
  status: BedStatus
  current_admission_id: string | null
}

export interface Ward {
  id: string
  name: string
  ward_type: WardType
  floor: string | null
  is_active: boolean
  beds: Bed[]
}

export interface Admission {
  id: string
  patient_id: string
  encounter_id: string | null
  ward_id: string
  bed_id: string
  diagnosis: string | null
  notes: string | null
  status: AdmissionStatus
  admitted_at: string
  discharged_at: string | null
  discharge_type: DischargeType | null
  discharge_diagnosis: string | null
  created_at: string
}

export interface AdmissionCreate {
  patient_id: string
  encounter_id?: string
  ward_id: string
  bed_id: string
  diagnosis?: string
  notes?: string
}

export interface DischargeCreate {
  discharge_type: DischargeType
  discharge_diagnosis?: string
  notes?: string
}

export const admissionsApi = {
  listWards: () => client.get<Ward[]>('/admissions/wards'),
  createWard: (data: Pick<Ward, 'name' | 'ward_type' | 'floor'>) =>
    client.post<Ward>('/admissions/wards', data),
  addBed: (wardId: string, data: { bed_number: string; bed_type?: string }) =>
    client.post<Bed>(`/admissions/wards/${wardId}/beds`, data),
  list: (params?: { patient_id?: string; ward_id?: string; status?: string }) =>
    client.get<Admission[]>('/admissions', { params }),
  admit: (data: AdmissionCreate) => client.post<Admission>('/admissions', data),
  getAdmission: (id: string) => client.get<Admission>(`/admissions/${id}`),
  discharge: (id: string, data: DischargeCreate) =>
    client.post<Admission>(`/admissions/${id}/discharge`, data),
}
