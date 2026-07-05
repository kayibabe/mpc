import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { patientsApi, type PatientCreate } from '../../api/patients'

const schema = z.object({
  first_name: z.string().min(1, 'First name required'),
  last_name: z.string().min(1, 'Last name required'),
  other_names: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']),
  blood_group: z.string().optional(),
  phone: z.string().optional(),
  phone_alt: z.string().optional(),
  address: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relation: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_number: z.string().optional(),
  known_allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
)

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function RegisterPatientPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: PatientCreate) => patientsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      navigate(`/reception/patients/${res.data.id}`)
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data as PatientCreate)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Register New Patient</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *" error={errors.first_name?.message}>
              <input {...register('first_name')} className={inputClass} />
            </Field>
            <Field label="Last Name *" error={errors.last_name?.message}>
              <input {...register('last_name')} className={inputClass} />
            </Field>
            <Field label="Other Names">
              <input {...register('other_names')} className={inputClass} />
            </Field>
            <Field label="Date of Birth">
              <input type="date" {...register('date_of_birth')} className={inputClass} />
            </Field>
            <Field label="Gender *" error={errors.gender?.message}>
              <select {...register('gender')} className={inputClass}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Blood Group">
              <select {...register('blood_group')} className={inputClass}>
                <option value="unknown">Unknown</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Contact & Address</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input {...register('phone')} className={inputClass} placeholder="+265..." />
            </Field>
            <Field label="Alt Phone">
              <input {...register('phone_alt')} className={inputClass} />
            </Field>
            <Field label="Village">
              <input {...register('village')} className={inputClass} />
            </Field>
            <Field label="District">
              <input {...register('district')} className={inputClass} placeholder="e.g. Zomba" />
            </Field>
            <div className="col-span-2">
              <Field label="Address">
                <textarea {...register('address')} rows={2} className={inputClass} />
              </Field>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Emergency Contact & Insurance</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Emergency Contact Name">
              <input {...register('emergency_contact_name')} className={inputClass} />
            </Field>
            <Field label="Emergency Contact Phone">
              <input {...register('emergency_contact_phone')} className={inputClass} />
            </Field>
            <Field label="Relationship">
              <input {...register('emergency_contact_relation')} className={inputClass} placeholder="e.g. Spouse" />
            </Field>
            <div />
            <Field label="Insurance Provider">
              <input {...register('insurance_provider')} className={inputClass} />
            </Field>
            <Field label="Insurance Number">
              <input {...register('insurance_number')} className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Medical History</h2>
          <div className="space-y-4">
            <Field label="Known Allergies">
              <textarea {...register('known_allergies')} rows={2} className={inputClass} />
            </Field>
            <Field label="Chronic Conditions">
              <textarea {...register('chronic_conditions')} rows={2} className={inputClass} />
            </Field>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm">Failed to register patient. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Registering...' : 'Register Patient'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
