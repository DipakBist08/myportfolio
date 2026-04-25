import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import api from '@/lib/api'
import {
  LayoutDashboard, FileText, Tag, FolderOpen, Users,
  Image, Settings, LogOut, ChevronRight, Bot, X,
} from 'lucide-react'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  badge?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Posts', to: '/posts', icon: <FileText size={18} /> },
  { label: 'Categories', to: '/categories', icon: <FolderOpen size={18} /> },
  { label: 'Tags', to: '/tags', icon: <Tag size={18} /> },
  { label: 'Subscribers', to: '/subscribers', icon: <Users size={18} /> },
  { label: 'Media', to: '/media', icon: <Image size={18} /> },
  { label: 'Settings', to: '/settings', icon: <Settings size={18} /> },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/api/v1/auth/logout', { refresh_token: refreshToken })
      }
    } catch {}
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col',
          'w-64 bg-[#0a0f1e] border-r border-white/8',
          'transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          !open && 'lg:w-0 lg:overflow-hidden'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-white leading-none">QA CMS</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Admin Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/20 text-primary-light border border-primary/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-primary-light' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-primary-light/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/8">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
