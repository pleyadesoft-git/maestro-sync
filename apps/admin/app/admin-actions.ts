'use server'

import { createAuthedClient } from '@music-flow/supabase'
import { createServiceRoleClient } from '@music-flow/supabase/server'

type DashboardUser = {
  id: string
  name: string
  email: string
  suspended: boolean
  plan: string
}

export type AdminOverview = {
  stats: { users: number; sessions: number; scores: number; subscriptions: number }
  users: DashboardUser[]
  topWorks: { title: string; composer: string | null; count: number }[]
  notifications: { id: string; type: string; payload: unknown; created_at: string; is_read: boolean }[]
}

/**
 * Verifica en el servidor que el llamador es un admin de plataforma autenticado.
 * Se le pasa su propio access token: primero se valida con RLS (anon + token),
 * y solo entonces se usan credenciales de servicio para las escrituras.
 */
async function requireAdmin(accessToken: string) {
  if (!accessToken) throw new Error('unauthenticated')

  const viewer = createAuthedClient(accessToken)
  const { data: userData, error: userError } = await viewer.auth.getUser()
  const user = userData.user
  if (userError || !user) throw new Error('unauthenticated')

  const { data: profile, error: profileError } = await viewer
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.is_platform_admin) throw new Error('forbidden')

  return { adminId: user.id, viewer }
}

export async function getAdminOverview(accessToken: string): Promise<AdminOverview> {
  await requireAdmin(accessToken)
  const admin = createServiceRoleClient()

  const [profilesRes, sessionsRes, scoresRes, subsRes, notificationsRes, worksRes, sessionsForTop] =
    await Promise.all([
      admin.from('profiles').select('id, full_name, is_suspended'),
      admin.from('sessions').select('id', { count: 'exact', head: true }),
      admin.from('scores').select('id', { count: 'exact', head: true }),
      admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['trialing', 'active', 'past_due']),
      admin
        .from('admin_notifications')
        .select('id, type, payload, created_at, is_read')
        .order('created_at', { ascending: false })
        .limit(15),
      admin.from('works').select('id, title, composer'),
      admin.from('sessions').select('work_version_id').limit(1000),
    ])

  const profiles = (profilesRes.data ?? []) as {
    id: string
    full_name: string | null
    is_suspended: boolean
  }[]

  // Emails desde Supabase Auth (solo posible con service role)
  let emailsById = new Map<string, string>()
  let plansByUserId = new Map<string, string>()
  try {
    let page = 1
    const seen = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        if (seen.has(u.id)) break
        seen.add(u.id)
        if (u.email) emailsById.set(u.id, u.email)
      }
      page += 1
      if (data.users.length < 200) break
    }
  } catch {
    // Si el listado de Auth falla, se muestran sin email
  }

  try {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('owner_user_id, plans ( code )')
      .in('status', ['trialing', 'active', 'past_due'])
    for (const sub of subs ?? []) {
      if (sub.owner_user_id) {
        plansByUserId.set(sub.owner_user_id, (sub.plans as any)?.code ?? 'activo')
      }
    }
  } catch {
    // sin datos de plan
  }

  const users: DashboardUser[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name || 'Sin nombre',
    email: emailsById.get(p.id) || '—',
    suspended: p.is_suspended,
    plan: plansByUserId.get(p.id) || 'free',
  }))

  // Top obras por número de sesiones
  const worksById = new Map(
    ((worksRes.data ?? []) as { id: string; title: string; composer: string | null }[]).map((w) => [
      w.id,
      w,
    ])
  )
  const versionToWork = new Map<string, string>()
  try {
    const { data: versions } = await admin.from('work_versions').select('id, work_id')
    for (const v of versions ?? []) versionToWork.set(v.id, v.work_id)
  } catch {
    // sin datos
  }

  const counts = new Map<string, number>()
  for (const s of (sessionsForTop.data ?? []) as { work_version_id: string }[]) {
    const workId = versionToWork.get(s.work_version_id)
    if (workId) counts.set(workId, (counts.get(workId) ?? 0) + 1)
  }
  const topWorks = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([workId, count]) => ({
      title: worksById.get(workId)?.title ?? 'Obra sin título',
      composer: worksById.get(workId)?.composer ?? null,
      count,
    }))

  return {
    stats: {
      users: profiles.length,
      sessions: sessionsRes.count ?? 0,
      scores: scoresRes.count ?? 0,
      subscriptions: subsRes.count ?? 0,
    },
    users,
    topWorks,
    notifications: (notificationsRes.data ?? []) as AdminOverview['notifications'],
  }
}

export async function setUserSuspended(
  accessToken: string,
  userId: string,
  suspended: boolean
): Promise<void> {
  const { adminId } = await requireAdmin(accessToken)
  const admin = createServiceRoleClient()

  const { error } = await admin.from('profiles').update({ is_suspended: suspended }).eq('id', userId)
  if (error) throw new Error(`No se pudo actualizar el usuario: ${error.message}`)

  const { error: logError } = await admin.from('moderation_actions').insert({
    admin_id: adminId,
    action: suspended ? 'suspend_user' : 'reinstate_user',
    target_type: 'user',
    target_id: userId,
    reason: suspended ? 'Suspendido desde el panel de administración' : 'Reinstalado desde el panel',
  })
  if (logError) console.error('No se registró la acción de moderación:', logError.message)
}

export async function signOutAdmin(accessToken: string): Promise<void> {
  if (!accessToken) return
  const client = createAuthedClient(accessToken)
  await client.auth.signOut()
}
