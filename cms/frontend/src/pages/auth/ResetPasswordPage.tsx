import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'

// Same rules as the API (app/schemas/auth.py), so mistakes show before sending.
const schema = z.object({
  password: z.string()
    .min(8, 'At least 8 characters')
    .refine(v => new TextEncoder().encode(v).length <= 72, 'At most 72 bytes')
    .refine(v => /[A-Z]/.test(v), 'Add an uppercase letter')
    .refine(v => /[a-z]/.test(v), 'Add a lowercase letter')
    .refine(v => /\d/.test(v), 'Add a digit'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormData = z.infer<typeof schema>

/** The emailed link is /reset-password#token=…  The token sits in the fragment,
 *  which browsers never send to a server. */
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(tokenFromUrl)
  // Once read, drop the token from the address bar so it is not left in
  // history or on screen. (An effect, not the initialiser: React may run an
  // initialiser twice, and the second run would find the token gone.)
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true })
  }, [location.hash, location.pathname, navigate])
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(
    token ? null : 'This page needs the link from your reset email. Request a new one.',
  )

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await api.post<{ detail: string }>('/api/v1/auth/reset-password', {
        token, new_password: data.password,
      })
      toast.success(res.data.detail)
      navigate('/login', { replace: true })
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 400 && typeof detail === 'string') {
        setLinkError(detail)
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        toast.error(String(detail[0].msg).replace(/^Value error, /, ''))
      } else {
        toast.error('Could not reset the password. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-6 sm:p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
              <LockKeyhole size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">Choose a new password</h1>
            {!linkError && (
              <p className="text-sm text-slate-400 mt-1">
                At least 8 characters, with an uppercase letter, a lowercase letter and a digit.
              </p>
            )}
          </div>

          {linkError ? (
            <div className="space-y-5" role="alert">
              <p className="text-sm text-slate-300 text-center">{linkError}</p>
              <Button type="button" variant="gradient" className="w-full h-10" onClick={() => navigate('/forgot-password')}>
                Request a new link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    {...register('password')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(p => !p)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('confirm')}
                />
                {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
              </div>

              <Button type="submit" variant="gradient" className="w-full h-10" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Set new password
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="block w-full text-center text-sm text-slate-400 hover:text-white mt-6 transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
