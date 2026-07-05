import client from './client'

export interface VitalSigns {
  id: string
  patient_id: string
  encounter_id: string | null
  admission_id: string | null
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  temperature: number | null
  spo2: number | null
  weight: number | null
  height: number | null
  respiratory_rate: number | null
  recorded_at: string
  notes: string | null
}

export interface NursingNote {
  id: string
  patient_id: string
  encounter_id: string | null
  admission_id: string | null
  content: string
  note_type: string
  created_at: string
}

export interface MAR {
  id: string
  prescription_item_id: string
  administered_by: string
  administered_at: string
  dose_given: string
  route: string
  notes: string | null
}

export interface VitalSignsCreate {
  patient_id: string
  encounter_id?: string
  admission_id?: string
  bp_systolic?: number
  bp_diastolic?: number
  pulse?: number
  temperature?: number
  spo2?: number
  weight?: number
  height?: number
  respiratory_rate?: number
  notes?: string
}

export interface MARCreate {
  prescription_item_id: string
  administered_by: string
  administered_at: string
  dose_given: string
  route: string
  notes?: string
}

export const nursingApi = {
  recordVitals: (data: VitalSignsCreate) => client.post<VitalSigns>('/nursing/vitals', data),
  listVitals: (params: { patient_id?: string; encounter_id?: string; admission_id?: string }) =>
    client.get<VitalSigns[]>('/nursing/vitals', { params }),
  addNote: (data: { patient_id: string; encounter_id?: string; admission_id?: string; content: string; note_type?: string }) =>
    client.post<NursingNote>('/nursing/notes', data),
  listNotes: (params: { patient_id?: string; admission_id?: string }) =>
    client.get<NursingNote[]>('/nursing/notes', { params }),
  recordMAR: (data: MARCreate) => client.post<MAR>('/nursing/mar', data),
  listMAR: (params: { patient_id?: string; admission_id?: string }) =>
    client.get<MAR[]>('/nursing/mar', { params }),
}
