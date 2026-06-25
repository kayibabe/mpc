import client from './client'

export interface Patient {
  id: string
  mrn: string
  first_name: string
  last_name: string
  other_names?: string
  date_of_birth?: string
  gender: string
  blood_group: string
  phone?: string
  phone_alt?: string
  email?: string
  address?: string
  village?: string
  district?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
  insurance_provider?: string
  insurance_number?: string
  known_allergies?: string
  chronic_conditions?: string
  created_at: string
  updated_at: string
}

export interface PatientCreate {
  first_name: string
  last_name: string
  other_names?: string
  date_of_birth?: string
  gender: 'male' | 'female' | 'other'
  blood_group?: string
  phone?: string
  phone_alt?: string
  email?: string
  address?: string
  village?: string
  district?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
  insurance_provider?: string
  insurance_number?: string
  known_allergies?: string
  chronic_conditions?: string
}

export const patientsApi = {
  list: (q?: string, skip = 0, limit = 50) =>
    client.get<Patient[]>('/patients', { params: { q, skip, limit } }),
  get: (id: string) => client.get<Patient>(`/patients/${id}`),
  create: (data: PatientCreate) => client.post<Patient>('/patients', data),
  update: (id: string, data: Partial<PatientCreate>) => client.put<Patient>(`/patients/${id}`, data),
}
