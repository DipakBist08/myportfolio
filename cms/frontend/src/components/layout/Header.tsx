import { Menu, Bell, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UserProfile } from '@/types'

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, setUser } = useAuthStore()

  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<UserProfile>('/api/v1/auth/me')
      setUser(res.data)
      return res.data
    },
    enabled: !user,
  })

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() ?? 'AD'

  return (
    <header className="h-14 px-5 flex items-center justify-between border-b border-white/8 bg-[#0a0f1e]/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:block">
          <p className="text-xs text-slate-500">Welcome back,</p>
          <p className="text-sm font-semibold text-white leading-none">{user?.full_name || user?.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/posts/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-primary text-white text-sm font-medium shadow-glow-sm hover:shadow-glow transition-shadow"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New Post</span>
        </Link>
        <button className="relative text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
          <Bell size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}
