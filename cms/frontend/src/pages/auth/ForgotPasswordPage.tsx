import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().email('Invalid email'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await api.post<{ detail: string }>('/api/v1/auth/forgot-password', data)
      setSentMessage(res.data.detail)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not send the reset email. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-6 sm:p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
              {sentMessage ? <MailCheck size={28} className="text-white" /> : <KeyRound size={28} className="text-white" />}
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">
              {sentMessage ? 'Check your email' : 'Forgot password?'}
            </h1>
            {!sentMessage && (
              <p className="text-sm text-slate-400 mt-1">
                Enter your admin email and we'll send you a link to choose a new password.
              </p>
            )}
          </div>

          {sentMessage ? (
            <div className="space-y-5" role="status">
              <p className="text-sm text-slate-300 text-center">{sentMessage}</p>
              <p className="text-xs text-slate-500 text-center">
                The link works once and expires in 30 minutes.
              </p>
              <Button type="button" variant="outline" className="w-full h-10" onClick={() => setSentMessage(null)}>
                Send another link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  autoFocus
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <Button type="submit" variant="gradient" className="w-full h-10" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Send reset link
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
