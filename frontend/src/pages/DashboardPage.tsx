import { useAuthStore } from '../store/auth'
import { Link } from 'react-router-dom'

const moduleCards = [
  { label: 'Reception', description: 'Patient registration & queue', path: '/reception', color: 'bg-blue-600', roles: ['receptionist', 'admin'] },
  { label: 'OPD', description: 'Outpatient consultations', path: '/opd', color: 'bg-green-600', roles: ['doctor', 'nurse', 'admin'] },
  { label: 'IPD', description: 'Inpatient admissions & ward', path: '/ipd', color: 'bg-purple-600', roles: ['doctor', 'nurse', 'admin'] },
  { label: 'Laboratory', description: 'Test orders & results', path: '/lab', color: 'bg-yellow-600', roles: ['lab_tech', 'doctor', 'admin'] },
  { label: 'Pharmacy', description: 'Dispensing & stock', path: '/pharmacy', color: 'bg-red-600', roles: ['pharmacist', 'admin'] },
  { label: 'Nursing', description: 'Vitals & medication records', path: '/nursing', color: 'bg-pink-600', roles: ['nurse', 'admin'] },
  { label: 'Billing', description: 'Invoices & payments', path: '/billing', color: 'bg-indigo-600', roles: ['billing_clerk', 'admin'] },
  { label: 'Admin', description: 'Staff, settings & reports', path: '/admin', color: 'bg-gray-700', roles: ['admin'] },
]

export default function DashboardPage() {
  const { user } = useAuthStore()

  const visible = moduleCards.filter((m) => user && m.roles.includes(user.role))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Good day, {user?.full_name?.split(' ')[0]}</h1>
      <p className="text-gray-500 text-sm mb-8">Welcome to Zomba City Private Clinic system</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visible.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className={`${m.color} text-white rounded-xl p-5 hover:opacity-90 transition-opacity shadow-sm`}
          >
            <h2 className="font-bold text-lg">{m.label}</h2>
            <p className="text-white/80 text-sm mt-1">{m.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
