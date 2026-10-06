'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, Button } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import {
  Users,
  DollarSign,
  Activity,
  Music,
  Shield,
  Bell,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserX,
  Search,
} from 'lucide-react'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscriptions'>('overview')
  const [notifications, setNotifications] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState({ users: 0, sessions: 0, scores: 0 })

  const supabase = createBrowserClient() as any

  useEffect(() => {
    const fetchData = async () => {
      // Fetch users
      const { data } = await supabase.from('profiles').select('*')
      const profiles = data as any[]
      if (profiles) {
        setUsers(profiles.map(p => ({
          id: p.id,
          name: p.full_name || 'Sin Nombre',
          email: 'Usuario Supabase Auth', // In a real app we'd join auth.users via an admin RPC
          plan: 'Plan Base', // Placeholder until joined with subscriptions
          status: p.is_suspended ? 'suspended' : 'active',
          suspended: p.is_suspended
        })))
      }

      // Fetch stats
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      const { count: sessionsCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'playing')
      const { count: scoresCount } = await supabase.from('scores').select('*', { count: 'exact', head: true })

      setStats({
        users: usersCount || 0,
        sessions: sessionsCount || 0,
        scores: scoresCount || 0,
      })

      // Fetch notifications
      const { data: nData } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      const notifs = nData as any[]
      if (notifs) {
        setNotifications(notifs.map(n => ({
          id: n.id,
          title: n.type,
          desc: JSON.stringify(n.payload),
          time: new Date(n.created_at).toLocaleTimeString(),
          read: n.is_read
        })))
      }
    }

    fetchData()

    // Realtime Notifications
    const channel = supabase.channel('admin_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (payload: any) => {
        setNotifications(prev => [{
          id: payload.new.id,
          title: payload.new.type,
          desc: JSON.stringify(payload.new.payload),
          time: new Date(payload.new.created_at).toLocaleTimeString(),
          read: payload.new.is_read
        }, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const toggleSuspendUser = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    const newSuspendedState = !user.suspended
    
    // Update local state optimistically
    setUsers(users.map((u) => (u.id === userId ? { ...u, suspended: newSuspendedState } : u)))

    // Update DB
    await supabase.from('profiles').update({ is_suspended: newSuspendedState } as any).eq('id', userId)
    
    // Log moderation action
    await supabase.from('moderation_actions').insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: newSuspendedState ? 'suspend_user' : 'reinstate_user',
      target_type: 'user',
      target_id: userId,
      reason: 'Toggled via Admin Dashboard'
    } as any)
  }

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

        {/* Realtime Notification Toast Counter */}
        <div className="relative">
          <button className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
              {notifications.filter((n) => !n.read).length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
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
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">MRR Estimado</p>
                    <h3 className="text-2xl font-bold text-slate-100 mt-1">$4,850 USD</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-emerald-400 gap-1 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+14.2% vs mes anterior</span>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuarios Totales</p>
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
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Salas Activas Ahora</p>
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
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partituras Subidas</p>
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
                  <CardDescription>Obras con mayor número de sesiones creadas esta semana.</CardDescription>
                </CardHeader>
                <div className="space-y-4">
                  {[
                    { title: 'Sinfonía No. 5 en Do Menor', composer: 'L. v. Beethoven', count: 142 },
                    { title: 'Las Cuatro Estaciones — El Verano', composer: 'A. Vivaldi', count: 98 },
                    { title: 'El Lago de los Cisnes', composer: 'P. I. Tchaikovsky', count: 76 },
                  ].map((work, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm">
                      <div>
                        <p className="font-semibold text-slate-200">{work.title}</p>
                        <p className="text-xs text-slate-400">{work.composer}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        {work.count} ejecuciones
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notificaciones Realtime</CardTitle>
                  <CardDescription>Eventos del canal admin_notifications</CardDescription>
                </CardHeader>
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-200">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-slate-500">{n.time}</span>
                      </div>
                      <p className="text-slate-400">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        ) : (
          /* Users Moderation Table */
          <Card>
            <CardHeader>
              <CardTitle>Gestión y Moderación de Usuarios</CardTitle>
              <CardDescription>Suspender o reinstalar cuentas de usuario en la plataforma.</CardDescription>
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
                        >
                          <UserX className="w-3.5 h-3.5 mr-1" />
                          {user.suspended ? 'Reinstalar' : 'Suspender'}
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
