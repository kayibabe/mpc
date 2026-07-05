import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '../../api/patients'
import { ArrowLeft } from 'lucide-react'

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(patientId!).then((r) => r.data),
    enabled: !!patientId,
  })

  if (isLoading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Loading patient...</div>
  }

  if (isError || !patient) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 text-sm mb-4">Patient not found.</p>
        <Link to="/reception" className="text-blue-600 text-sm hover:underline">Back to patients</Link>
      </div>
    )
  }

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div key={label} className="flex flex-col">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-sm text-gray-800">{value}</span>
      </div>
    ) : null

  return (
    <div>
      <Link to="/reception" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-6">
        <ArrowLeft size={14} /> Back to patients
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {patient.last_name}, {patient.first_name}
            {patient.other_names ? ` ${patient.other_names}` : ''}
          </h1>
          <span className="font-mono text-blue-700 text-sm">{patient.mrn}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {row('Gender', patient.gender)}
            {row('Date of Birth', patient.date_of_birth)}
            {row('Blood Group', patient.blood_group)}
            {row('Phone', patient.phone)}
            {row('Alt Phone', patient.phone_alt)}
            {row('Email', patient.email)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Address</h2>
          <div className="grid grid-cols-2 gap-4">
            {row('Village', patient.village)}
            {row('District', patient.district)}
            {row('Address', patient.address)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            {row('Name', patient.emergency_contact_name)}
            {row('Phone', patient.emergency_contact_phone)}
            {row('Relationship', patient.emergency_contact_relation)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Medical & Insurance</h2>
          <div className="grid grid-cols-2 gap-4">
            {row('Insurance Provider', patient.insurance_provider)}
            {row('Insurance #', patient.insurance_number)}
            {row('Known Allergies', patient.known_allergies)}
            {row('Chronic Conditions', patient.chronic_conditions)}
          </div>
        </div>
      </div>
    </div>
  )
}
