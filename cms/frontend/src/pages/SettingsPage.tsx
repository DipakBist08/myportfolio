import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, ShieldCheck, Loader2, User, Globe, Share2, BookOpen, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { UserProfile } from '@/types'

type SettingsMap = Record<string, Record<string, { value: string; label: string; description: string }>>

const TABS = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'blog', label: 'Blog', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: ShieldCheck },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, setUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('general')
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({})
  const [profileForm, setProfileForm] = useState({ full_name: '', bio: '', avatar_url: '' })
  const [mfaQr, setMfaQr] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [showQr, setShowQr] = useState(false)

  const { data: settings } = useQuery<SettingsMap>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/api/v1/settings')).data,
  })

  useEffect(() => {
    if (settings) {
      const flat: Record<string, string> = {}
      Object.values(settings).forEach(cat => {
        Object.entries(cat).forEach(([key, val]) => { flat[key] = val.value })
      })
      setSiteSettings(flat)
    }
  }, [settings])

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name, bio: user.bio, avatar_url: user.avatar_url })
  }, [user])

  const saveSiteMutation = useMutation({
    mutationFn: () => api.patch('/api/v1/settings', siteSettings),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved') },
  })

  const saveProfileMutation = useMutation({
    mutationFn: () => api.patch('/api/v1/auth/me', profileForm),
    onSuccess: (res) => { setUser(res.data); toast.success('Profile updated') },
  })

  const setupMfa = async () => {
    try {
      const res = await api.post('/api/v1/auth/mfa/setup')
      setMfaQr(res.data.qr_code_url)
      setMfaSecret(res.data.secret)
      setShowQr(true)
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const confirmMfa = async () => {
    try {
      await api.post('/api/v1/auth/mfa/confirm', { otp_code: mfaCode })
      toast.success('MFA enabled!')
      setShowQr(false)
      setMfaCode('')
      qc.invalidateQueries({ queryKey: ['me'] })
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Invalid code') }
  }

  const disableMfa = async () => {
    const code = prompt('Enter your authenticator code to disable MFA:')
    if (!code) return
    try {
      await api.post('/api/v1/auth/mfa/disable', { otp_code: code })
      toast.success('MFA disabled')
      qc.invalidateQueries({ queryKey: ['me'] })
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const renderSetting = (key: string, meta: { value: string; label: string; description: string }) => (
    <div key={key} className="space-y-1.5">
      <Label>{meta.label}</Label>
      <Input
        value={siteSettings[key] ?? meta.value}
        onChange={e => setSiteSettings(p => ({ ...p, [key]: e.target.value }))}
        placeholder={meta.label}
      />
      {meta.description && <p className="text-xs text-slate-500">{meta.description}</p>}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Configure your CMS and profile</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary-light bg-primary/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {(activeTab === 'general' || activeTab === 'social' || activeTab === 'blog') && settings && (
        <div className="glass-card p-5 space-y-4">
          {Object.entries(settings[activeTab] ?? {}).map(([key, meta]) => renderSetting(key, meta))}
          <Button onClick={() => saveSiteMutation.mutate()} variant="gradient" size="sm" disabled={saveSiteMutation.isPending}>
            {saveSiteMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
            Save Settings
          </Button>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xl font-bold">
              {user?.full_name?.[0] ?? user?.username?.[0] ?? 'A'}
            </div>
            <div>
              <p className="font-semibold text-white">{user?.username}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Short bio…" />
          </div>
          <div className="space-y-1.5">
            <Label>Avatar URL</Label>
            <Input value={profileForm.avatar_url} onChange={e => setProfileForm(p => ({ ...p, avatar_url: e.target.value }))} placeholder="https://…" />
          </div>
          <Button onClick={() => saveProfileMutation.mutate()} variant="gradient" size="sm">
            <Save size={14} className="mr-1.5" /> Save Profile
          </Button>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-4">
          {/* MFA */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" />
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  {user?.mfa_enabled ? 'MFA is enabled on your account.' : 'Add an extra layer of security.'}
                </p>
              </div>
              {user?.mfa_enabled ? (
                <Button variant="outline" size="sm" onClick={disableMfa} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                  Disable MFA
                </Button>
              ) : (
                <Button variant="gradient" size="sm" onClick={setupMfa}>
                  <QrCode size={14} className="mr-1.5" /> Enable MFA
                </Button>
              )}
            </div>

            {showQr && mfaQr && (
              <div className="space-y-3 pt-3 border-t border-border">
                <p className="text-sm text-slate-300">
                  1. Install Google Authenticator, Authy, or any TOTP app.<br />
                  2. Scan the QR code below or enter the secret manually.<br />
                  3. Enter the 6-digit code to confirm.
                </p>
                <div className="flex justify-center">
                  <img src={mfaQr} alt="MFA QR Code" className="rounded-lg border border-border bg-white p-2" style={{ width: 180, height: 180 }} />
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Secret (manual entry)</p>
                  <p className="font-mono text-sm text-white">{mfaSecret}</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter 6-digit code"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                    maxLength={6}
                    className="font-mono text-center tracking-widest"
                  />
                  <Button onClick={confirmMfa} variant="gradient" disabled={mfaCode.length !== 6}>Confirm</Button>
                </div>
              </div>
            )}
          </div>

          {/* Change password section */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-white">Change Password</h3>
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </div>
  )
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/api/v1/auth/change-password', {
        current_password: form.current_password, new_password: form.new_password,
      })
      toast.success('Password changed!')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Current Password</Label>
        <Input type="password" value={form.current_password} onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>New Password</Label>
        <Input type="password" value={form.new_password} onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm New Password</Label>
        <Input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
      </div>
      <Button type="submit" size="sm" variant="gradient" disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
        Update Password
      </Button>
    </form>
  )
}
