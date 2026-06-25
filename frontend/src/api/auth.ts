import client from './client'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface CurrentUser {
  id: string
  employee_id: string
  full_name: string
  role: string
  department: string | null
}

export interface StaffUser extends CurrentUser {
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  employee_id: string
  full_name: string
  password: string
  role: string
  department?: string
}

export const authApi = {
  login: (employee_id: string, password: string) =>
    client.post<TokenResponse>('/auth/login', { employee_id, password }),
  me: () => client.get<CurrentUser>('/auth/me'),
  register: (data: UserCreate) => client.post<StaffUser>('/auth/register', data),
  listUsers: () => client.get<StaffUser[]>('/admin/users'),
  updateUser: (id: string, data: Partial<Pick<StaffUser, 'is_active' | 'role'>>) =>
    client.put<StaffUser>(`/admin/users/${id}`, data),
}
