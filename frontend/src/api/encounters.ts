import client from './client'

export type EncounterType = 'opd' | 'ipd' | 'emergency'
export type EncounterStatus = 'open' | 'closed' | 'referred'
export type TriageCategory = 'immediate' | 'urgent' | 'non_urgent'

export interface Encounter {
  id: string
  patient_id: string
  encounter_type: EncounterType
  encounter_date: string
  attending_doctor_id: string | null
  chief_complaint: string | null
  status: EncounterStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface EncounterDetail extends Encounter {
  triage: Triage | null
  notes: ClinicalNote[]
}

export interface Triage {
  id: string
  encounter_id: string
  nurse_id: string
  triage_category: TriageCategory
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  temperature: number | null
  spo2: number | null
  weight: number | null
  height: number | null
  respiratory_rate: number | null
  pain_score: number | null
  notes: string | null
  assessed_at: string
}

export interface ClinicalNote {
  id: string
  encounter_id: string
  author_id: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  diagnoses: unknown[] | null
  created_at: string
  updated_at: string
}

export interface EncounterCreate {
  patient_id: string
  encounter_type?: EncounterType
  attending_doctor_id?: string
  chief_complaint?: string
  department?: string
}

export interface TriageCreate {
  triage_category: TriageCategory
  bp_systolic?: number
  bp_diastolic?: number
  pulse?: number
  temperature?: number
  spo2?: number
  weight?: number
  height?: number
  respiratory_rate?: number
  pain_score?: number
  notes?: string
}

export interface ClinicalNoteCreate {
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  diagnoses?: string[]
}

export const encountersApi = {
  list: (params?: { patient_id?: string; status?: string; encounter_date?: string; encounter_type?: string }) =>
    client.get<Encounter[]>('/encounters', { params }),
  create: (data: EncounterCreate) => client.post<Encounter>('/encounters', data),
  get: (id: string) => client.get<EncounterDetail>(`/encounters/${id}`),
  update: (id: string, data: Partial<EncounterCreate & { status: EncounterStatus }>) =>
    client.put<Encounter>(`/encounters/${id}`, data),
  upsertTriage: (id: string, data: TriageCreate) =>
    client.post<Triage>(`/encounters/${id}/triage`, data),
  listNotes: (id: string) => client.get<ClinicalNote[]>(`/encounters/${id}/notes`),
  addNote: (id: string, data: ClinicalNoteCreate) =>
    client.post<ClinicalNote>(`/encounters/${id}/notes`, data),
}
