'use server'

import { createAuthedClient } from '@music-flow/supabase'
import { cancelStripeSubscription, reactivateStripeSubscription } from '@music-flow/stripe'
import {
  createServiceRoleClient,
  getSuperAdminEmails,
  bootstrapSuperAdmins,
  createCourtesyCode,
  listCourtesyCodes,
  revokeCourtesyCode,
  listVisionProviders,
  createVisionProvider,
  updateVisionProvider,
  deleteVisionProvider,
  reorderVisionProviders,
  testVisionProviderConnection,
  runAllVisionProvidersHealthCheck,
  type CourtesyCodeRecord,
  type CourtesyPlanCode,
  type VisionProviderRecord,
  type VisionProviderType,
  type CreateVisionProviderInput,
  type UpdateVisionProviderInput,
  type VisionHealthCheckReport,
} from '@music-flow/supabase/server'

export type {
  CourtesyCodeRecord,
  CourtesyPlanCode,
  VisionProviderRecord,
  VisionProviderType,
  CreateVisionProviderInput,
  UpdateVisionProviderInput,
  VisionHealthCheckReport,
}

export type DashboardUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
  suspended: boolean
  planCode: string
  planName: string
  paymentStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'expired'
  isCourtesy: boolean
  isTrialActive: boolean
  trialDaysLeft: number | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionId: string | null
}

export type DashboardSuperAdmin = {
  id: string | null
  email: string
  name: string
  avatarUrl: string | null
  status: 'active' | 'pending_first_login'
  lastSignInAt: string | null
  createdAt: string | null
}

export type AdminOverview = {
  stats: {
    users: number
    superAdmins: number
    sessions: number
    scores: number
    subscriptions: number
    trialingUsers: number
    pastDueSubscriptions: number
    courtesyCodesActive: number
    courtesyCodesRedeemed: number
  }
  users: DashboardUser[]
  superAdmins: DashboardSuperAdmin[]
  courtesyCodes: CourtesyCodeRecord[]
  topWorks: { title: string; composer: string | null; count: number }[]
  notifications: { id: string; type: string; payload: unknown; created_at: string; is_read: boolean }[]
}

/**
 * Verifica en el servidor que el llamador es un admin de plataforma autenticado.
 * REGLA ESTRICTA: Solamente las cuentas de correo especificadas en SUPER_ADMIN_BOOTSTRAP_EMAILS
 * pueden abrir el panel de administración.
 * Además, si la cuenta no existe en la base de datos (public.profiles), se agrega automáticamente.
 */
async function requireAdmin(accessToken: string) {
  if (!accessToken) throw new Error('unauthenticated')

  const viewer = createAuthedClient(accessToken)
  const { data: userData, error: userError } = await viewer.auth.getUser()
  const user = userData.user
  if (userError || !user) throw new Error('unauthenticated')

  const userEmail = user.email?.trim().toLowerCase()
  const superAdminEmails = getSuperAdminEmails()

  // Si SUPER_ADMIN_BOOTSTRAP_EMAILS está configurado, SOLAMENTE esas cuentas pueden acceder
  if (superAdminEmails.length > 0) {
    if (!userEmail || !superAdminEmails.includes(userEmail)) {
      throw new Error('forbidden_unauthorized_email')
    }
  }

  const admin = createServiceRoleClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // Si la cuenta autorizada inicia sesión (ej. con Google OAuth) y no tiene perfil aún,
    // se agrega automáticamente a la base de datos con is_platform_admin = true.
    const defaultName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      userEmail?.split('@')[0] ||
      'Super Admin'

    const avatarUrl =
      (user.user_metadata?.avatar_url as string) ||
      (user.user_metadata?.picture as string) ||
      null

    await admin.from('profiles').insert({
      id: user.id,
      full_name: defaultName,
      avatar_url: avatarUrl,
      preferred_language: 'es',
      is_platform_admin: true,
    })
  } else if (!profile.is_platform_admin) {
    // Si ya existía pero no tenía el flag, se le asigna is_platform_admin = true
    await admin.from('profiles').update({ is_platform_admin: true }).eq('id', user.id)
  }

  return { adminId: user.id, email: userEmail, viewer }
}

export async function verifyAdminAccess(accessToken: string): Promise<{
  ok: boolean
  userId: string
  email: string | null
}> {
  const { adminId, email } = await requireAdmin(accessToken)
  return { ok: true, userId: adminId, email: email ?? null }
}

export async function runBootstrapSuperAdmins(accessToken: string) {
  await requireAdmin(accessToken)
  return await bootstrapSuperAdmins()
}

function formatPlanFriendlyName(code: string, rawName: string | null | undefined): string {
  if (rawName && rawName !== code) return rawName
  switch (code) {
    case 'solo_monthly':
    case 'individual_monthly':
      return 'Solo ($5 USD/mes)'
    case 'solo_annual':
    case 'individual_annual':
      return 'Solo Anual ($51 USD/año)'
    case 'band_monthly':
      return 'Band ($65 USD/mes)'
    case 'band_annual':
      return 'Band Anual ($663 USD/año)'
    case 'orchestra_monthly':
      return 'Orchestra ($95 USD/mes)'
    case 'orchestra_annual':
      return 'Orchestra Anual ($969 USD/año)'
    case 'free':
      return 'Prueba Gratuita (7 días)'
    default:
      return rawName || code
  }
}

export async function getAdminOverview(accessToken: string): Promise<AdminOverview> {
  await requireAdmin(accessToken)

  // Asegura en la BD que todas las cuentas de SUPER_ADMIN_BOOTSTRAP_EMAILS existan
  try {
    await bootstrapSuperAdmins()
  } catch (err) {
    console.error('Error sincronizando super admins en getAdminOverview:', err)
  }

  const admin = createServiceRoleClient()

  const [profilesRes, sessionsRes, scoresRes, subsRes, notificationsRes, worksRes, sessionsForTop] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, avatar_url, is_platform_admin, is_suspended, trial_ends_at, created_at'),
      admin.from('sessions').select('id', { count: 'exact', head: true }),
      admin.from('scores').select('id', { count: 'exact', head: true }),
      admin
        .from('subscriptions')
        .select(`
          id,
          owner_user_id,
          organization_id,
          stripe_customer_id,
          stripe_subscription_id,
          status,
          current_period_end,
          cancel_at_period_end,
          plans (
            code,
            name,
            price_cents,
            billing_interval
          )
        `),
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
    avatar_url: string | null
    is_platform_admin: boolean
    is_suspended: boolean
    trial_ends_at: string | null
    created_at: string
  }[]

  type AuthUserInfo = {
    id: string
    email?: string
    created_at: string
    last_sign_in_at?: string | null
    user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string }
  }

  const authUsersById = new Map<string, AuthUserInfo>()
  const authUsersByEmail = new Map<string, AuthUserInfo>()
  try {
    let page = 1
    const seen = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        if (seen.has(u.id)) break
        seen.add(u.id)
        const info: AuthUserInfo = {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          user_metadata: u.user_metadata,
        }
        authUsersById.set(u.id, info)
        if (u.email) {
          authUsersByEmail.set(u.email.trim().toLowerCase(), info)
        }
      }
      page += 1
      if (data.users.length < 200) break
    }
  } catch (err) {
    console.error('Error listando auth users en admin:', err)
  }

  type SubscriptionWithPlan = {
    id: string
    owner_user_id: string | null
    organization_id: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
    current_period_end: string | null
    cancel_at_period_end: boolean
    plans: {
      code: string
      name: string | null
      price_cents: number
      billing_interval: string | null
    } | null
  }

  const subscriptionsByUserId = new Map<string, SubscriptionWithPlan>()
  for (const sub of (subsRes.data ?? []) as unknown as SubscriptionWithPlan[]) {
    if (sub.owner_user_id) {
      const existing = subscriptionsByUserId.get(sub.owner_user_id)
      if (!existing || sub.status === 'active' || (sub.status === 'trialing' && existing.status !== 'active')) {
        subscriptionsByUserId.set(sub.owner_user_id, sub)
      }
    }
  }

  // Identificar el conjunto de super administradores
  const superAdminEmails = getSuperAdminEmails()
  const superAdminSet = new Set<string>(superAdminEmails)
  const profilesById = new Map(profiles.map((p) => [p.id, p]))

  // Incluir en superAdminSet a cualquier perfil con is_platform_admin = true
  for (const p of profiles) {
    if (p.is_platform_admin) {
      const email = authUsersById.get(p.id)?.email?.toLowerCase()
      if (email) superAdminSet.add(email)
    }
  }

  // Lista de Super Admins para su propia pestaña
  const superAdmins: DashboardSuperAdmin[] = Array.from(superAdminSet).map((email) => {
    const authUser = authUsersByEmail.get(email)
    const profile = authUser ? profilesById.get(authUser.id) : undefined

    const name =
      profile?.full_name ||
      (authUser?.user_metadata?.full_name as string) ||
      (authUser?.user_metadata?.name as string) ||
      email.split('@')[0] ||
      'Super Admin'

    const avatarUrl =
      profile?.avatar_url ||
      (authUser?.user_metadata?.avatar_url as string) ||
      (authUser?.user_metadata?.picture as string) ||
      null

    const hasLoggedIn = Boolean(authUser?.last_sign_in_at || profile)

    return {
      id: profile?.id || authUser?.id || null,
      email,
      name,
      avatarUrl,
      status: hasLoggedIn ? 'active' : 'pending_first_login',
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      createdAt: profile?.created_at || authUser?.created_at || null,
    }
  })

  // Lista de Usuarios Clientes Registrados (excluyendo a Super Admins)
  const clientProfiles = profiles.filter((p) => {
    if (p.is_platform_admin) return false
    const email = authUsersById.get(p.id)?.email?.toLowerCase()
    if (email && superAdminSet.has(email)) return false
    return true
  })

  const nowMs = Date.now()

  const users: DashboardUser[] = clientProfiles.map((p) => {
    const authUser = authUsersById.get(p.id)
    const email = authUser?.email || '—'
    const sub = subscriptionsByUserId.get(p.id)

    // Cálculo del período de prueba de 7 días
    let isTrialActive = false
    let trialDaysLeft: number | null = null
    const trialEndsAt = p.trial_ends_at || null

    if (trialEndsAt) {
      const trialEndMs = Date.parse(trialEndsAt)
      const diffMs = trialEndMs - nowMs
      if (diffMs > 0) {
        isTrialActive = true
        trialDaysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      } else {
        isTrialActive = false
        trialDaysLeft = 0
      }
    }

    let planCode = 'free'
    let planName = 'Prueba Gratuita (7 días)'
    let paymentStatus: DashboardUser['paymentStatus'] = 'trialing'
    const isCourtesy = Boolean(
      sub &&
        (sub.stripe_customer_id === 'courtesy_1m' ||
          sub.stripe_subscription_id?.startsWith('courtesy_'))
    )

    if (sub && sub.plans) {
      planCode = sub.plans.code
      const baseFriendlyName = formatPlanFriendlyName(sub.plans.code, sub.plans.name)
      planName = isCourtesy ? `${baseFriendlyName.split(' (')[0]} (Cortesía 7 Días)` : baseFriendlyName
      paymentStatus = sub.status
      if (sub.current_period_end && Date.parse(sub.current_period_end) < nowMs && sub.status === 'active' && isCourtesy) {
        paymentStatus = 'expired'
      }
    } else {
      // Sin suscripción en Stripe
      if (isTrialActive) {
        paymentStatus = 'trialing'
        planCode = 'free'
        planName = 'Prueba Gratuita (7 días)'
      } else {
        paymentStatus = 'expired'
        planCode = 'free'
        planName = 'Prueba Expirada'
      }
    }

    return {
      id: p.id,
      name: p.full_name || 'Sin nombre',
      email,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at || authUser?.created_at || new Date().toISOString(),
      suspended: p.is_suspended,
      planCode,
      planName,
      paymentStatus,
      isCourtesy,
      isTrialActive,
      trialDaysLeft,
      trialEndsAt,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
      stripeCustomerId: sub?.stripe_customer_id ?? null,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
      subscriptionId: sub?.id ?? null,
    }
  })

  // Cargar códigos de cortesía y enriquecer con el usuario que lo canjeó
  let rawCourtesyCodes: CourtesyCodeRecord[] = []
  try {
    rawCourtesyCodes = await listCourtesyCodes()
  } catch (err) {
    console.error('Error listando códigos de cortesía en admin:', err)
  }

  const courtesyCodes: CourtesyCodeRecord[] = rawCourtesyCodes.map((c) => {
    const redeemerAuth = c.redeemedBy ? authUsersById.get(c.redeemedBy) : undefined
    const redeemerProfile = c.redeemedBy ? profilesById.get(c.redeemedBy) : undefined
    return {
      ...c,
      redeemedByEmail: redeemerAuth?.email ?? null,
      redeemedByName: redeemerProfile?.full_name ?? redeemerAuth?.user_metadata?.full_name ?? null,
    }
  })

  const courtesyCodesActive = courtesyCodes.filter((c) => c.status === 'active').length
  const courtesyCodesRedeemed = courtesyCodes.filter((c) => c.status === 'redeemed').length

  // Métricas financieras y de usuarios
  const activeSubsCount = users.filter((u) => u.paymentStatus === 'active').length
  const trialingCount = users.filter((u) => u.paymentStatus === 'trialing').length
  const pastDueCount = users.filter((u) => u.paymentStatus === 'past_due').length

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
      users: users.length,
      superAdmins: superAdmins.length,
      sessions: sessionsRes.count ?? 0,
      scores: scoresRes.count ?? 0,
      subscriptions: activeSubsCount,
      trialingUsers: trialingCount,
      pastDueSubscriptions: pastDueCount,
      courtesyCodesActive,
      courtesyCodesRedeemed,
    },
    users,
    superAdmins,
    courtesyCodes,
    topWorks,
    notifications: (notificationsRes.data ?? []).filter(
      (n: any) => n.type !== 'courtesy_code_record'
    ) as AdminOverview['notifications'],
  }
}

export async function generateCourtesyCodeAction(
  accessToken: string,
  planCode: CourtesyPlanCode,
  note?: string
): Promise<CourtesyCodeRecord> {
  const { adminId } = await requireAdmin(accessToken)
  if (!['solo_monthly', 'band_monthly', 'orchestra_monthly'].includes(planCode)) {
    throw new Error('Tier de cortesía inválido.')
  }
  return await createCourtesyCode({
    planCode,
    note,
    createdBy: adminId,
    durationDays: 7,
  })
}

export async function revokeCourtesyCodeAction(
  accessToken: string,
  codeId: string
): Promise<void> {
  await requireAdmin(accessToken)
  await revokeCourtesyCode(codeId)
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

// =====================================================================
// PROVEEDORES DE VISIÓN IA (CRUD + Drag & Drop Prioridad + Test)
// =====================================================================

export async function listVisionProvidersAction(accessToken: string): Promise<{
  providers: VisionProviderRecord[]
  tableMissing: boolean
}> {
  await requireAdmin(accessToken)
  return await listVisionProviders()
}

export async function createVisionProviderAction(
  accessToken: string,
  input: Omit<CreateVisionProviderInput, 'createdBy'>
): Promise<VisionProviderRecord> {
  const { adminId } = await requireAdmin(accessToken)
  if (!input.name?.trim()) throw new Error('El nombre del proveedor es obligatorio.')
  if (!input.modelName?.trim()) throw new Error('El nombre del modelo es obligatorio.')
  if (!input.apiKey?.trim()) throw new Error('La API Key es obligatoria.')
  return await createVisionProvider({
    ...input,
    createdBy: adminId,
  })
}

export async function updateVisionProviderAction(
  accessToken: string,
  id: string,
  updates: UpdateVisionProviderInput
): Promise<VisionProviderRecord> {
  await requireAdmin(accessToken)
  if (!id) throw new Error('ID de proveedor inválido.')
  return await updateVisionProvider(id, updates)
}

export async function deleteVisionProviderAction(
  accessToken: string,
  id: string
): Promise<void> {
  await requireAdmin(accessToken)
  if (!id) throw new Error('ID de proveedor inválido.')
  await deleteVisionProvider(id)
}

export async function reorderVisionProvidersAction(
  accessToken: string,
  orderedIds: string[]
): Promise<VisionProviderRecord[]> {
  await requireAdmin(accessToken)
  return await reorderVisionProviders(orderedIds)
}

export async function testVisionProviderAction(
  accessToken: string,
  id: string
): Promise<{
  ok: boolean
  latencyMs: number
  message: string
  provider?: VisionProviderRecord
}> {
  await requireAdmin(accessToken)
  return await testVisionProviderConnection(id)
}

export async function runVisionHealthCheckAction(
  accessToken: string
): Promise<VisionHealthCheckReport> {
  await requireAdmin(accessToken)
  return await runAllVisionProvidersHealthCheck()
}


// =====================================================================
// GESTIÓN DE SUSCRIPCIONES (CANCELACIÓN / REACTIVACIÓN ADMINISTRATIVA)
// =====================================================================

export async function cancelSubscriptionAdminAction(
  accessToken: string,
  {
    subscriptionId,
    userId,
    immediate = false,
    reason,
  }: {
    subscriptionId?: string
    userId?: string
    immediate?: boolean
    reason?: string
  }
): Promise<void> {
  const { adminId } = await requireAdmin(accessToken)
  const admin = createServiceRoleClient()

  let query = admin.from('subscriptions').select('*')
  if (subscriptionId) {
    query = query.eq('id', subscriptionId)
  } else if (userId) {
    query = query.eq('owner_user_id', userId)
  } else {
    throw new Error('Debes proveer un subscriptionId o userId.')
  }

  const { data: sub, error: subError } = await query
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subError || !sub) {
    throw new Error('No se encontró una suscripción activa para cancelar.')
  }

  const isStripe =
    Boolean(sub.stripe_subscription_id) &&
    !sub.stripe_subscription_id!.startsWith('courtesy-') &&
    !sub.stripe_subscription_id!.startsWith('MS-')

  let newStatus = sub.status
  let newCancelAtPeriodEnd = !immediate

  if (isStripe && sub.stripe_subscription_id) {
    try {
      const stripeSub = await cancelStripeSubscription({
        stripeSubscriptionId: sub.stripe_subscription_id,
        immediate,
      })
      if (immediate || stripeSub.status === 'canceled') {
        newStatus = 'canceled'
        newCancelAtPeriodEnd = false
      } else {
        newCancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end)
      }
    } catch (stripeErr: any) {
      if (stripeErr.code === 'resource_missing') {
        newStatus = 'canceled'
        newCancelAtPeriodEnd = false
      } else {
        throw new Error(stripeErr.message || 'Error cancelando en Stripe.')
      }
    }
  } else {
    if (immediate) {
      newStatus = 'canceled'
      newCancelAtPeriodEnd = false
    } else {
      newCancelAtPeriodEnd = true
    }
  }

  const { error: updateErr } = await admin
    .from('subscriptions')
    .update({
      status: newStatus as any,
      cancel_at_period_end: newCancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)

  if (updateErr) throw new Error(updateErr.message)

  await admin.from('moderation_actions').insert({
    admin_id: adminId,
    action: immediate ? 'cancel_subscription_immediate' : 'cancel_subscription_period_end',
    target_type: 'subscription',
    target_id: sub.id,
    reason: reason || (immediate ? 'Cancelada inmediatamente por admin' : 'Cancelación a fin de ciclo por admin'),
  })

  await admin.from('admin_notifications').insert({
    type: immediate ? 'cancellation' : 'cancellation_scheduled',
    payload: {
      admin_id: adminId,
      subscription_id: sub.id,
      user_id: sub.owner_user_id,
      immediate,
      reason: reason || 'Acción administrativa',
      canceled_at: new Date().toISOString(),
    },
  })
}

export async function reactivateSubscriptionAdminAction(
  accessToken: string,
  {
    subscriptionId,
    userId,
  }: {
    subscriptionId?: string
    userId?: string
  }
): Promise<void> {
  const { adminId } = await requireAdmin(accessToken)
  const admin = createServiceRoleClient()

  let query = admin.from('subscriptions').select('*')
  if (subscriptionId) {
    query = query.eq('id', subscriptionId)
  } else if (userId) {
    query = query.eq('owner_user_id', userId)
  } else {
    throw new Error('Debes proveer un subscriptionId o userId.')
  }

  const { data: sub, error: subError } = await query
    .eq('cancel_at_period_end', true)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subError || !sub) {
    throw new Error('No se encontró una suscripción con cancelación programada para reactivar.')
  }

  const isStripe =
    Boolean(sub.stripe_subscription_id) &&
    !sub.stripe_subscription_id!.startsWith('courtesy-') &&
    !sub.stripe_subscription_id!.startsWith('MS-')

  if (isStripe && sub.stripe_subscription_id) {
    await reactivateStripeSubscription({
      stripeSubscriptionId: sub.stripe_subscription_id,
    })
  }

  const { error: updateErr } = await admin
    .from('subscriptions')
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)

  if (updateErr) throw new Error(updateErr.message)

  await admin.from('moderation_actions').insert({
    admin_id: adminId,
    action: 'reactivate_subscription',
    target_type: 'subscription',
    target_id: sub.id,
    reason: 'Reactivada desde el panel administrativo',
  })
}


