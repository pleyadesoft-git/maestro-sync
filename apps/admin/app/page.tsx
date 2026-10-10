'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { getAdminOverview, setUserSuspended, type AdminOverview } from './admin-actions'
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
} from 'lucide-react'

type AuthPhase = 'loading' | 'anon' | 'forbidden' | 'ready'
type Notification = AdminOverview['notifications'][number]

export default function AdminDashboard() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>('loading')
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const getToken = async (): Promise<string | null> => {
    const supabase = createBrowserClient()
    const { data } = await supabase.auth.getSession()
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
      if (message.includes('forbidden')) {
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(
        error.message.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : error.message
      )
      setAuthLoading(false)
      return
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
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-100">Acceso restringido</h1>
            <p className="text-sm text-slate-400 max-w-md">
              Esta cuenta no es administradora de la plataforma (is_platform_admin = false).
            </p>
          </div>
          <Button onClick={handleSignOut} variant="secondary">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </main>
      )
    }

    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-lg leading-none">MaestroSync Admin</h1>
            <span className="text-xs text-slate-400">Inicia sesión con una cuenta admin</span>
          </div>
        </div>

        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-xl">Acceso al Panel</CardTitle>
            <CardDescription>
              Requiere una cuenta con <code className="text-amber-400">is_platform_admin</code>.
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

          <form onSubmit={handleLogin} className="space-y-4 px-6 pb-6">
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
            <Button type="submit" variant="primary" className="w-full" disabled={authLoading}>
              {authLoading ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </main>
    )
  }

  /* ---------------- Dashboard ---------------- */

  const stats = overview?.stats ?? { users: 0, sessions: 0, scores: 0, subscriptions: 0 }
  const users = overview?.users ?? []
  const topWorks = overview?.topWorks ?? []

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-lg leading-none">MaestroSync Admin</h1>
            <span className="text-xs text-slate-400">Panel de Administración de Plataforma</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime Notification Counter */}
          <div className="relative">
            <button className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 transition-colors">
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
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
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
            Usuarios ({users.length})
          </Button>
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Suscripciones Activas
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">
                      {stats.subscriptions}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Trialing, activas o con pago pendiente</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Usuarios Totales
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.users}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Registrados en la plataforma</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Salas Activas Ahora
                    </p>
                    <h3 className="text-2xl font-bold text-amber-400 mt-1">{stats.sessions}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Sesiones en estado playing</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Partituras Subidas
                    </p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.scores}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <Music className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Totales en Storage</p>
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
        ) : (
          /* Users Moderation Table */
          <Card>
            <CardHeader>
              <CardTitle>Gestión y Moderación de Usuarios</CardTitle>
              <CardDescription>
                Suspender o reinstalar cuentas de usuario en la plataforma.
              </CardDescription>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Plan Actual</th>
                    <th className="py-3 px-4">Estado Cuenta</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-300">{user.plan}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}

function AlertCircleIcon() {
  return <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
}
