import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '../store/auth'

const navItems = [
  { label: 'Reception', path: '/reception', roles: ['receptionist', 'admin'] },
  { label: 'OPD', path: '/opd', roles: ['doctor', 'nurse', 'admin'] },
  { label: 'IPD', path: '/ipd', roles: ['doctor', 'nurse', 'admin'] },
  { label: 'Laboratory', path: '/lab', roles: ['lab_tech', 'doctor', 'admin'] },
  { label: 'Pharmacy', path: '/pharmacy', roles: ['pharmacist', 'admin'] },
  { label: 'Nursing', path: '/nursing', roles: ['nurse', 'admin'] },
  { label: 'Billing', path: '/billing', roles: ['billing_clerk', 'admin'] },
  { label: 'Admin', path: '/admin', roles: ['admin'] },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = navItems.filter((item) => user && item.roles.includes(user.role))

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {visibleNav.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onClick}
          className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            location.pathname.startsWith(item.path)
              ? 'bg-blue-100 text-blue-800'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-1 rounded hover:bg-blue-700"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-lg">ZCPC</span>
          <span className="text-blue-300 text-sm hidden sm:inline">Zomba City Private Clinic</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-200 hidden sm:inline">{user?.full_name} ({user?.role})</span>
          <button onClick={handleLogout} className="text-sm text-blue-300 hover:text-white">
            Sign out
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 space-y-1">
          <NavLinks onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex flex-1">
        <aside className="w-48 bg-white border-r border-gray-200 py-4 hidden md:block">
          <nav className="space-y-1 px-2">
            <NavLinks />
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
