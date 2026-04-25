import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { TokenResponse } from '@/types'

export default function MFAVerifyPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
    if (next.every(d => d !== '')) submitCode(next.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const submitCode = async (otp: string) => {
    const temp_token = sessionStorage.getItem('mfa_temp_token')
    if (!temp_token) { navigate('/login'); return }
    setLoading(true)
    try {
      const res = await api.post<TokenResponse>('/api/v1/auth/mfa/verify', {
        temp_token, otp_code: otp,
      })
      sessionStorage.removeItem('mfa_temp_token')
      setTokens(res.data.access_token, res.data.refresh_token)
      toast.success('Authenticated!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid code')
      setCode(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-heading font-bold text-white">Two-Factor Auth</h1>
            <p className="text-sm text-slate-400 mt-1 text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-11 h-13 text-center text-xl font-mono font-bold bg-input border border-border rounded-lg text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                style={{ height: '52px' }}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {loading && (
            <div className="flex justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          )}

          <button
            onClick={() => navigate('/login')}
            className="w-full text-center text-sm text-slate-400 hover:text-white mt-4 transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  )
}
