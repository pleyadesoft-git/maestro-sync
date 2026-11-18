'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import {
  getAdminOverview,
  setUserSuspended,
  generateCourtesyCodeAction,
  revokeCourtesyCodeAction,
  type AdminOverview,
  type CourtesyCodeRecord,
  type CourtesyPlanCode,
} from './admin-actions'
import {
  Users,
  CreditCard,
  Activity,
  Music,
  Shield,
  Bell,
  AlertTriangle,
  CheckCircle2,
  UserX,
  Mail,
  Lock,
  LogOut,
  Loader2,
  Search,
  Clock,
  ShieldCheck,
  Gift,
  Copy,
  Check,
  XCircle,
  Plus,
} from 'lucide-react'

type AuthPhase = 'loading' | 'anon' | 'forbidden' | 'ready'
type Notification = AdminOverview['notifications'][number]

export default function AdminDashboard() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>('loading')
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courtesies' | 'superadmins'>('overview')
  const [userSearch, setUserSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trialing' | 'past_due' | 'expired'>('all')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  // Estados para Generación de Cortesías de 1 Mes
  const [courtesyPlan, setCourtesyPlan] = useState<CourtesyPlanCode>('solo_monthly')
  const [courtesyNote, setCourtesyNote] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [lastCreatedCode, setLastCreatedCode] = useState<CourtesyCodeRecord | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [revokingCodeId, setRevokingCodeId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const getToken = async (): Promise<string | null> => {
    const supabase = createBrowserClient()
    const { data } = await supabase.auth.getSession()
    if (data.session?.user?.email) {
      setCurrentUserEmail(data.session.user.email)
    }
    return data.session?.access_token ?? null
  }

  const loadOverview = useCallback(async (token: string) => {
    try {
      const data = await getAdminOverview(token)
      setOverview(data)
      setNotifications(data.notifications)
      setAuthPhase('ready')
    } catch (e: any) {
      const message = String(e?.message ?? e)
      if (message.includes('forbidden') || message.includes('unauthorized_email')) {
        setAuthPhase('forbidden')
      } else if (message.includes('unauthenticated')) {
        setAuthPhase('anon')
      } else {
        setAuthError('No se pudo cargar el panel: ' + message)
        setAuthPhase('anon')
      }
    }
  }, [])

  useEffect(() => {
    const boot = async () => {
      const token = await getToken()
      if (!token) {
        setAuthPhase('anon')
        return
      }
      await loadOverview(token)
    }
    boot()
  }, [loadOverview])

  // Escuchar cambios de autenticación (ej. retorno de Google OAuth o token refresh)
  useEffect(() => {
    const supabase = createBrowserClient()
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email) {
          setCurrentUserEmail(session.user.email)
        }
        if (session?.access_token) {
          await loadOverview(session.access_token)
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserEmail(null)
        setOverview(null)
        setNotifications([])
        setAuthPhase('anon')
      }
    })

    return () => {
      authSub.subscription.unsubscribe()
    }
  }, [loadOverview])

  // Realtime: notificaciones de la plataforma (requiere sesión de admin)
  useEffect(() => {
    if (authPhase !== 'ready') return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('admin:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload: any) => {
          setNotifications((prev) => [
            {
              id: payload.new.id,
              type: payload.new.type,
              payload: payload.new.payload,
              created_at: payload.new.created_at,
              is_read: payload.new.is_read,
            },
            ...prev,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authPhase])

  const handleGoogleLogin = async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const supabase = createBrowserClient()
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) {
        setAuthError(error.message)
        setAuthLoading(false)
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Error al conectar con Google OAuth.')
      setAuthLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid') as HTMLElement
      if (firstInvalid) firstInvalid.focus()
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    const supabase = createBrowserClient()
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(
        error.message.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : error.message
      )
      setAuthLoading(false)
      return
    }
    if (signInData.user?.email) {
      setCurrentUserEmail(signInData.user.email)
    }
    const token = await getToken()
    if (token) await loadOverview(token)
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    setOverview(null)
    setNotifications([])
    setCurrentUserEmail(null)
    setAuthPhase('anon')
  }

  const toggleSuspendUser = async (userId: string) => {
    const user = overview?.users.find((u) => u.id === userId)
    if (!user || busyUserId) return

    setActionError(null)
    setBusyUserId(userId)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
      await setUserSuspended(token, userId, !user.suspended)
      const data = await getAdminOverview(token)
      setOverview(data)
    } catch (e: any) {
      setActionError(String(e?.message ?? e))
    } finally {
      setBusyUserId(null)
    }
  }

  const handleGenerateCourtesyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (generatingCode) return
    setActionError(null)
    setGeneratingCode(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
      const created = await generateCourtesyCodeAction(token, courtesyPlan, courtesyNote)
      setLastCreatedCode(created)
      setCourtesyNote('')
      const data = await getAdminOverview(token)
      setOverview(data)
    } catch (e: any) {
      setActionError(String(e?.message ?? e))
    } finally {
      setGeneratingCode(false)
    }
  }

  const handleRevokeCourtesyCode = async (codeId: string) => {
    if (revokingCodeId) return
    setActionError(null)
    setRevokingCodeId(codeId)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
      await revokeCourtesyCodeAction(token, codeId)
      const data = await getAdminOverview(token)
      setOverview(data)
    } catch (e: any) {
      setActionError(String(e?.message ?? e))
    } finally {
      setRevokingCodeId(null)
    }
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2500)
    } catch {
      // fallback
    }
  }

  /* ---------------- Puerta de autenticación ---------------- */

  if (authPhase === 'loading') {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-sm text-slate-400">Verificando credenciales…</p>
      </main>
    )
  }

  if (authPhase === 'anon' || authPhase === 'forbidden') {
    if (authPhase === 'forbidden') {
      return (
        <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-2 max-w-md">
            <h1 className="text-xl font-bold text-slate-100">Acceso restringido</h1>
            <p className="text-sm text-slate-400">
              {currentUserEmail ? (
                <>
                  La cuenta <span className="font-semibold text-amber-400">{currentUserEmail}</span> no
                  tiene permisos para administrar la plataforma.
                </>
              ) : (
                'Esta cuenta no está autorizada para acceder al panel de administración.'
              )}
            </p>
            <p className="text-xs text-slate-500">
              Solamente los correos autorizados en{' '}
              <code className="text-amber-400/90 font-mono">SUPER_ADMIN_BOOTSTRAP_EMAILS</code> pueden ingresar.
            </p>
          </div>
          <Button onClick={handleSignOut} variant="secondary">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión e intentar con otra cuenta
          </Button>
        </main>
      )
    }

    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt="MaestroSync Logo"
            className="w-11 h-11 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-950/30"
          />
          <div>
            <h1 className="font-extrabold text-slate-100 text-xl leading-none tracking-tight">
              Maestro<span className="text-amber-500">Sync</span>{' '}
              <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider ml-1">
                Admin
              </span>
            </h1>
            <span className="text-xs text-slate-400">Panel de Administración de Plataforma</span>
          </div>
        </div>

        <Card className="max-w-md w-full border-amber-500/20 shadow-2xl shadow-amber-950/20">
          <CardHeader>
            <CardTitle className="text-xl">Acceso al Panel</CardTitle>
            <CardDescription>
              Acceso exclusivo para las cuentas autorizadas en MaestroSync.
            </CardDescription>
          </CardHeader>

          {authError && (
            <div
              role="alert"
              className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
            >
              <AlertCircleIcon />
              <span>{authError}</span>
            </div>
          )}

          {/* Botón de acceso con Google OAuth */}
          <div className="px-6 mb-5">
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full h-12 border-slate-700 hover:border-amber-400/60 hover:bg-slate-900 flex items-center justify-center gap-3 font-semibold text-slate-100 transition-colors"
            >
              <GoogleIcon className="w-5 h-5 shrink-0" />
              <span>{authLoading ? 'Conectando…' : 'Acceder con Google'}</span>
            </Button>
          </div>

          <div className="relative flex items-center justify-center px-6 mb-5">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider absolute">
              O con Correo y Contraseña
            </span>
          </div>

          <form noValidate onSubmit={handleLogin} className="space-y-4 px-6 pb-6">
            <Input
              label="Correo Electrónico"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Contraseña"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Button type="submit" variant="primary" className="w-full h-11 text-sm font-semibold" disabled={authLoading}>
              {authLoading ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </main>
    )
  }

  /* ---------------- Dashboard ---------------- */

  const stats = overview?.stats ?? {
    users: 0,
    superAdmins: 0,
    sessions: 0,
    scores: 0,
    subscriptions: 0,
    trialingUsers: 0,
    pastDueSubscriptions: 0,
    courtesyCodesActive: 0,
    courtesyCodesRedeemed: 0,
  }
  const users = overview?.users ?? []
  const superAdmins = overview?.superAdmins ?? []
  const courtesyCodes = overview?.courtesyCodes ?? []
  const topWorks = overview?.topWorks ?? []

  // Filtrado de usuarios clientes
  const filteredUsers = users.filter((u) => {
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim()
      const matchesName = u.name.toLowerCase().includes(q)
      const matchesEmail = u.email.toLowerCase().includes(q)
      const matchesPlan = u.planName.toLowerCase().includes(q) || u.planCode.toLowerCase().includes(q)
      if (!matchesName && !matchesEmail && !matchesPlan) return false
    }
    if (statusFilter === 'all') return true
    if (statusFilter === 'active') return u.paymentStatus === 'active'
    if (statusFilter === 'trialing') return u.paymentStatus === 'trialing'
    if (statusFilter === 'past_due') return u.paymentStatus === 'past_due'
    if (statusFilter === 'expired') return u.paymentStatus === 'expired' || u.paymentStatus === 'canceled'
    return true
  })

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt="MaestroSync Logo"
            className="w-9 h-9 rounded-xl border border-amber-500/30 shadow-md shadow-amber-950/30"
          />
          <div>
            <h1 className="font-extrabold text-slate-100 text-lg leading-none tracking-tight">
              Maestro<span className="text-amber-500">Sync</span>{' '}
              <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider ml-1">
                Admin
              </span>
            </h1>
            <span className="text-xs text-slate-400">Panel de Administración de Plataforma</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUserEmail && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-slate-800 border border-slate-700 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {currentUserEmail}
            </span>
          )}
          {/* Realtime Notification Counter */}
          <div className="relative">
            <button type="button" className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            </button>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-1.5" />
            Salir
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
          <Button
            onClick={() => setActiveTab('overview')}
            variant={activeTab === 'overview' ? 'primary' : 'ghost'}
            size="sm"
          >
            Vista General
          </Button>
          <Button
            onClick={() => setActiveTab('users')}
            variant={activeTab === 'users' ? 'primary' : 'ghost'}
            size="sm"
          >
            <Users className="w-4 h-4 mr-1.5" />
            Usuarios Registrados ({users.length})
          </Button>
          <Button
            onClick={() => setActiveTab('courtesies')}
            variant={activeTab === 'courtesies' ? 'primary' : 'ghost'}
            size="sm"
          >
            <Gift className="w-4 h-4 mr-1.5" />
            Cortesías 1 Mes ({courtesyCodes.length})
          </Button>
          <Button
            onClick={() => setActiveTab('superadmins')}
            variant={activeTab === 'superadmins' ? 'primary' : 'ghost'}
            size="sm"
          >
            <Shield className="w-4 h-4 mr-1.5" />
            Super-Admins ({superAdmins.length})
          </Button>
        </div>

        {/* TAB 1: VISTA GENERAL */}
        {activeTab === 'overview' && (
          <>
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Card className="border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Planes Activos
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">
                      {stats.subscriptions}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Suscripciones pagadas al día</p>
              </Card>

              <Card className="border-sky-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Prueba (7 días)
                    </p>
                    <h3 className="text-2xl font-bold text-sky-400 mt-1">
                      {stats.trialingUsers}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Evaluando la plataforma</p>
              </Card>

              <Card className="border-rose-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Pagos Pendientes
                    </p>
                    <h3 className="text-2xl font-bold text-rose-400 mt-1">
                      {stats.pastDueSubscriptions}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Cobros atrasados / atención</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Clientes Registrados
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.users}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Músicos y directores</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Salas Activas
                    </p>
                    <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.sessions}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Activity className="w-4 h-4 animate-pulse" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Sesiones en reproducción</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Partituras
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.scores}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Music className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Totales en Storage</p>
              </Card>
            </div>

            {/* Recent Realtime Notifications & Top Works */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Top Partituras más Ejecutadas</CardTitle>
                  <CardDescription>Obras con mayor número de sesiones creadas.</CardDescription>
                </CardHeader>
                <div className="space-y-4">
                  {topWorks.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Todavía no hay sesiones registradas en la plataforma.
                    </p>
                  ) : (
                    topWorks.map((work, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{work.title}</p>
                          <p className="text-xs text-slate-400">{work.composer ?? '—'}</p>
                        </div>
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          {work.count} ejecuciones
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notificaciones Realtime</CardTitle>
                  <CardDescription>Eventos del canal admin:notifications</CardDescription>
                </CardHeader>
                <div className="space-y-3">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin notificaciones todavía.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span>{n.type}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(n.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-400 truncate">{JSON.stringify(n.payload)}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {/* TAB 2: USUARIOS REGISTRADOS (CLIENTES / SUSCRIPCIONES) */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Usuarios Registrados y Suscripciones</CardTitle>
                  <CardDescription>
                    Monitoreo de músicos y directores registrados, vigencia de su prueba de 7 días, planes contratados y cobros en Stripe.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o correo…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 w-64"
                    />
                  </div>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === 'all'
                      ? 'bg-slate-700 text-slate-100 shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Todos ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    statusFilter === 'active'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Activos de Pago ({users.filter((u) => u.paymentStatus === 'active').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('trialing')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    statusFilter === 'trialing'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow'
                      : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  En Prueba 7d ({users.filter((u) => u.paymentStatus === 'trialing').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('past_due')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    statusFilter === 'past_due'
                      ? 'bg-rose-500 text-slate-950 font-bold shadow'
                      : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Pago Pendiente ({users.filter((u) => u.paymentStatus === 'past_due').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('expired')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === 'expired'
                      ? 'bg-slate-600 text-slate-100 shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Expirados / Cancelados ({users.filter((u) => u.paymentStatus === 'expired' || u.paymentStatus === 'canceled').length})
                </button>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Estatus de Pago / Prueba</th>
                    <th className="py-3 px-4">Renovación & Facturación</th>
                    <th className="py-3 px-4">Cuenta</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                        No se encontraron usuarios que coincidan con los criterios.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                        {/* Usuario */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {user.avatarUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                                {user.name[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-200">{user.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Reg: {new Date(user.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                              user.planCode.startsWith('orchestra')
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : user.planCode.startsWith('band')
                                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                  : user.planCode.startsWith('solo')
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {user.planName}
                          </span>
                        </td>

                        {/* Estatus de Pago / Prueba */}
                        <td className="py-4 px-4">
                          {user.paymentStatus === 'active' && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                user.isCourtesy
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {user.isCourtesy ? (
                                <>
                                  <Gift className="w-3.5 h-3.5" /> Cortesía 1 Mes
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Activo (Al día)
                                </>
                              )}
                            </span>
                          )}
                          {user.paymentStatus === 'trialing' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <Clock className="w-3.5 h-3.5" /> Prueba ({user.trialDaysLeft ?? 0}d restantes)
                            </span>
                          )}
                          {user.paymentStatus === 'past_due' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Pago Pendiente
                            </span>
                          )}
                          {user.paymentStatus === 'expired' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              {user.isCourtesy ? 'Cortesía Expirada' : 'Prueba Expirada'}
                            </span>
                          )}
                          {user.paymentStatus === 'canceled' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              Cancelada
                            </span>
                          )}
                          {user.paymentStatus === 'incomplete' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Incompleto
                            </span>
                          )}
                        </td>

                        {/* Renovación & Facturación */}
                        <td className="py-4 px-4">
                          {user.currentPeriodEnd ? (
                            <div>
                              <div className="text-xs text-slate-300 font-medium">
                                {user.isCourtesy ? 'Vence:' : 'Renueva:'}{' '}
                                {new Date(user.currentPeriodEnd).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              {user.cancelAtPeriodEnd && !user.isCourtesy && (
                                <span className="inline-block mt-0.5 text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                  Cancela al fin de ciclo
                                </span>
                              )}
                              {user.stripeCustomerId && (
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {user.isCourtesy ? user.stripeSubscriptionId : user.stripeCustomerId}
                                </div>
                              )}
                            </div>
                          ) : user.paymentStatus === 'trialing' ? (
                            <div className="text-xs text-slate-400">
                              Prueba hasta:{' '}
                              <span className="text-slate-200">
                                {user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '7 días'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>

                        {/* Estado Cuenta */}
                        <td className="py-4 px-4">
                          {user.suspended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              <AlertTriangle className="w-3 h-3" /> Suspendido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Activo
                            </span>
                          )}
                        </td>

                        {/* Acción */}
                        <td className="py-4 px-4 text-right">
                          <Button
                            onClick={() => toggleSuspendUser(user.id)}
                            variant={user.suspended ? 'secondary' : 'danger'}
                            size="sm"
                            disabled={busyUserId !== null}
                          >
                            <UserX className="w-3.5 h-3.5 mr-1" />
                            {busyUserId === user.id
                              ? 'Aplicando…'
                              : user.suspended
                                ? 'Reinstalar'
                                : 'Suspender'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 3: CORTESÍAS DE 1 MES */}
        {activeTab === 'courtesies' && (
          <div className="space-y-6">
            <Card className="border-amber-500/30 bg-slate-900/80">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Generar Código de Cortesía (1 Mes)</CardTitle>
                    <CardDescription>
                      Genera un código de uso único que otorga 30 días gratuitos en el tier seleccionado (Solo, Band u Orchestra).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleGenerateCourtesyCode} className="space-y-5">
                <fieldset className="space-y-2.5">
                  <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    1. Selecciona el Tier de la Cortesía (30 días)
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {[
                      {
                        code: 'solo_monthly' as CourtesyPlanCode,
                        title: 'Solo',
                        subtitle: 'Solistas y músicos independientes ($5/mes)',
                        badge: '1 Músico',
                      },
                      {
                        code: 'band_monthly' as CourtesyPlanCode,
                        title: 'Band',
                        subtitle: 'Bandas y ensambles ($65/mes)',
                        badge: '2 a 20 Músicos',
                      },
                      {
                        code: 'orchestra_monthly' as CourtesyPlanCode,
                        title: 'Orchestra',
                        subtitle: 'Orquesta completa ($95/mes)',
                        badge: 'Ilimitado',
                      },
                    ].map((tier) => {
                      const selected = courtesyPlan === tier.code
                      return (
                        <label
                          key={tier.code}
                          className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between gap-2 ${
                            selected
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                              : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="courtesy_tier"
                                value={tier.code}
                                checked={selected}
                                onChange={() => setCourtesyPlan(tier.code)}
                                className="accent-amber-500 w-4 h-4"
                              />
                              <span className="font-bold text-slate-100 text-sm">{tier.title}</span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {tier.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 pl-6">{tier.subtitle}</p>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <Input
                      label="Nota o Destinatario (Opcional)"
                      type="text"
                      placeholder="Ej. Cortesía Director Invitado Filarmónica / Festival..."
                      value={courtesyNote}
                      onChange={(e) => setCourtesyNote(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={generatingCode}
                    className="h-11 w-full font-semibold"
                  >
                    {generatingCode ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Generar Código (1 Mes)
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {lastCreatedCode && (
                <div
                  role="status"
                  className="mt-6 p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>¡Código de cortesía de 1 mes generado con éxito!</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Tier: <strong>{lastCreatedCode.planName}</strong> • Compártelo con el usuario para que lo canjee al registrarse o en la sección de Planes.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 font-mono text-base font-extrabold text-amber-400 tracking-wider">
                      {lastCreatedCode.code}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyCode(lastCreatedCode.code)}
                    >
                      {copiedCode === lastCreatedCode.code ? (
                        <>
                          <Check className="w-4 h-4 mr-1 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle>Historial de Códigos de Cortesía</CardTitle>
                    <CardDescription>
                      {stats.courtesyCodesActive} disponibles para canje • {stats.courtesyCodesRedeemed} canjeados
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Tier (1 Mes)</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Nota / Destinatario</th>
                      <th className="py-3 px-4">Canjeado Por</th>
                      <th className="py-3 px-4">Creado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {courtesyCodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                          Aún no se han generado códigos de cortesía.
                        </td>
                      </tr>
                    ) : (
                      courtesyCodes.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <code className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 text-xs">
                                {c.code}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(c.code)}
                                title="Copiar código"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                              >
                                {copiedCode === c.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-200">
                            {c.planName}
                          </td>
                          <td className="py-3.5 px-4">
                            {c.status === 'active' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Disponible
                              </span>
                            )}
                            {c.status === 'redeemed' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Gift className="w-3 h-3" /> Canjeado
                              </span>
                            )}
                            {(c.status === 'revoked' || c.status === 'expired') && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                <XCircle className="w-3 h-3" /> Revocado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            {c.note || <span className="text-slate-500">—</span>}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {c.status === 'redeemed' ? (
                              <div>
                                <div className="font-semibold text-slate-200">
                                  {c.redeemedByName || c.redeemedByEmail || 'Usuario registrado'}
                                </div>
                                {c.redeemedByEmail && (
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {c.redeemedByEmail}
                                  </div>
                                )}
                                {c.redeemedAt && (
                                  <div className="text-[10px] text-slate-500">
                                    {new Date(c.redeemedAt).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">Sin canjear</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {c.status === 'active' ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                disabled={revokingCodeId === c.id}
                                onClick={() => handleRevokeCourtesyCode(c.id)}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                {revokingCodeId === c.id ? 'Revocando…' : 'Revocar'}
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: SUPER-ADMINS */}
        {activeTab === 'superadmins' && (
          <div className="space-y-6">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Equipo de Super-Administración de Plataforma</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Estas cuentas están autorizadas estrictamente mediante la variable de entorno{' '}
                    <code className="text-amber-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      SUPER_ADMIN_BOOTSTRAP_EMAILS
                    </code>
                    . Tienen acceso total a este panel, pueden iniciar sesión mediante Google OAuth o credenciales autorizadas, y no están sujetas a planes ni suscripciones de cobro.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Super-Administradores Autorizados</CardTitle>
                <CardDescription>
                  Listado de correos con permisos maestros sobre MaestroSync.
                </CardDescription>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Super-Admin</th>
                      <th className="py-3 px-4">Estatus de Acceso</th>
                      <th className="py-3 px-4">Último Inicio de Sesión</th>
                      <th className="py-3 px-4">Fecha de Alta</th>
                      <th className="py-3 px-4 text-right">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {superAdmins.map((adminUser, idx) => (
                      <tr key={adminUser.email || idx} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {adminUser.avatarUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={adminUser.avatarUrl}
                                alt={adminUser.name}
                                className="w-8 h-8 rounded-full object-cover border border-amber-500/40"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-bold text-amber-400">
                                <Shield className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-200">{adminUser.name}</div>
                              <div className="text-xs text-amber-400 font-mono">{adminUser.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {adminUser.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Activo / Autenticado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5" /> Pendiente primer login
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-xs text-slate-300">
                          {adminUser.lastSignInAt
                            ? new Date(adminUser.lastSignInAt).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Sin registro previo'}
                        </td>

                        <td className="py-4 px-4 text-xs text-slate-400">
                          {adminUser.createdAt
                            ? new Date(adminUser.createdAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Shield className="w-3.5 h-3.5" />
                            Super-Admin
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

function AlertCircleIcon() {
  return <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  )
}

