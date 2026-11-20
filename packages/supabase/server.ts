import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

import fs from 'fs'
import path from 'path'

/**
 * Cliente con service role. SOLO para el servidor (webhooks, Server Actions).
 * Nunca importar desde Client Components ni desde el barrel `./index`.
 */
function resolveServerEnv(): { supabaseUrl?: string; serviceKey?: string } {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceKey) {
    try {
      const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '../.env'),
        path.resolve(process.cwd(), '.env.local'),
      ]
      for (const filePath of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8')
          if (!supabaseUrl) {
            const urlMatch = content.match(/^(?:NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL)=(.*)$/m)
            if (urlMatch && urlMatch[1]) supabaseUrl = urlMatch[1].trim()
          }
          if (!serviceKey) {
            const keyMatch = content.match(/^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)=(.*)$/m)
            if (keyMatch && keyMatch[1]) serviceKey = keyMatch[1].trim()
          }
          if (supabaseUrl && serviceKey) break
        }
      }
    } catch {
      // fallback silencioso
    }
  }

  return { supabaseUrl, serviceKey }
}

/**
 * Cliente con service role. SOLO para el servidor (webhooks, Server Actions).
 * Nunca importar desde Client Components ni desde el barrel `./index`.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const { supabaseUrl, serviceKey } = resolveServerEnv()

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      '[music-flow] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en el entorno del servidor.'
    )
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Obtiene la lista de correos autorizados para Super Admin desde la variable
 * de entorno SUPER_ADMIN_BOOTSTRAP_EMAILS.
 */
export function getSuperAdminEmails(): string[] {
  let raw = process.env.SUPER_ADMIN_BOOTSTRAP_EMAILS || ''

  // En entorno local de desarrollo, intentar leer desde archivos .env si no está en process.env
  if (!raw) {
    try {
      const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '../.env'),
        path.resolve(process.cwd(), '.env.local'),
      ]
      for (const filePath of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8')
          const match = content.match(/^SUPER_ADMIN_BOOTSTRAP_EMAILS=(.*)$/m)
          if (match && match[1]) {
            raw = match[1].trim()
            break
          }
        }
      }
    } catch {
      // Ignorar errores de lectura en entornos donde fs no tenga permisos
    }
  }

  return raw
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Determina si un correo pertenece a la lista de Super Admins autorizados.
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const list = getSuperAdminEmails()
  if (list.length === 0) return false
  return list.includes(email.trim().toLowerCase())
}

/**
 * Agrega y asegura en la base de datos (auth.users y public.profiles)
 * las cuentas de correo especificadas en SUPER_ADMIN_BOOTSTRAP_EMAILS.
 */
export async function bootstrapSuperAdmins(): Promise<{
  bootstrapped: string[]
  errors: { email: string; error: string }[]
}> {
  const emails = getSuperAdminEmails()
  const bootstrapped: string[] = []
  const errors: { email: string; error: string }[] = []

  if (emails.length === 0) {
    return { bootstrapped, errors }
  }

  const admin = createServiceRoleClient()

  // 1. Obtener usuarios existentes de Auth
  const existingUsersByEmail = new Map<string, string>()
  try {
    let page = 1
    for (let i = 0; i < 10; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        if (u.email) {
          existingUsersByEmail.set(u.email.toLowerCase(), u.id)
        }
      }
      if (data.users.length < 200) break
      page += 1
    }
  } catch (err: any) {
    console.error('[bootstrapSuperAdmins] Error listando usuarios de auth:', err?.message)
  }

  for (const email of emails) {
    try {
      let userId = existingUsersByEmail.get(email)

      // Si no existe en auth.users, crearlo con email confirmado
      if (!userId) {
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: email.split('@')[0],
          },
        })

        if (createErr) {
          if (
            createErr.message.includes('already registered') ||
            createErr.message.includes('exists')
          ) {
            const { data: retryList } = await admin.auth.admin.listUsers({ perPage: 500 })
            const found = retryList?.users?.find((u) => u.email?.toLowerCase() === email)
            if (found) userId = found.id
          } else {
            errors.push({ email, error: createErr.message })
            continue
          }
        } else if (newUser?.user?.id) {
          userId = newUser.user.id
        }
      }

      if (!userId) {
        errors.push({ email, error: 'No se pudo obtener el ID del usuario en auth' })
        continue
      }

      // Asegurar existencia en public.profiles con is_platform_admin = true
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id, is_platform_admin')
        .eq('id', userId)
        .maybeSingle()

      if (!existingProfile) {
        const { error: insertErr } = await admin.from('profiles').insert({
          id: userId,
          full_name: email.split('@')[0],
          preferred_language: 'es',
          is_platform_admin: true,
        })
        if (insertErr) {
          errors.push({ email, error: `Error creando perfil: ${insertErr.message}` })
          continue
        }
      } else if (!existingProfile.is_platform_admin) {
        const { error: updateErr } = await admin
          .from('profiles')
          .update({ is_platform_admin: true })
          .eq('id', userId)
        if (updateErr) {
          errors.push({ email, error: `Error actualizando perfil: ${updateErr.message}` })
          continue
        }
      }

      bootstrapped.push(email)
    } catch (err: any) {
      errors.push({ email, error: err?.message || 'Error inesperado' })
    }
  }

  return { bootstrapped, errors }
}

export type CourtesyPlanCode = 'solo_monthly' | 'band_monthly' | 'orchestra_monthly'

export type CourtesyCodeRecord = {
  id: string
  code: string
  planCode: CourtesyPlanCode
  planName: string
  durationDays: number
  status: 'active' | 'redeemed' | 'revoked' | 'expired'
  note: string | null
  createdBy: string | null
  redeemedBy: string | null
  redeemedByEmail?: string | null
  redeemedByName?: string | null
  redeemedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export function getCourtesyPlanLabel(planCode: string): string {
  switch (planCode) {
    case 'solo_monthly':
      return 'Solo (Cortesía 7 Días)'
    case 'band_monthly':
      return 'Band (Cortesía 7 Días)'
    case 'orchestra_monthly':
      return 'Orchestra (Cortesía 7 Días)'
    default:
      return 'Cortesía 7 Días'
  }
}

function generateRandomCodeString(planCode: CourtesyPlanCode): string {
  const prefix =
    planCode === 'orchestra_monthly'
      ? 'MS-ORCH-'
      : planCode === 'band_monthly'
        ? 'MS-BAND-'
        : 'MS-SOLO-'
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}${token}`
}

function isMissingCourtesyTableError(err: any): boolean {
  const msg = String(err?.message || err?.code || '').toLowerCase()
  return (
    msg.includes('42p01') ||
    msg.includes('courtesy_codes') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

export async function createCourtesyCode(params: {
  planCode: CourtesyPlanCode
  note?: string
  createdBy?: string | null
  durationDays?: number
}): Promise<CourtesyCodeRecord> {
  const admin = createServiceRoleClient()
  const durationDays = params.durationDays ?? 7
  const cleanNote = params.note?.trim() || null
  const code = generateRandomCodeString(params.planCode)
  const nowIso = new Date().toISOString()

  const { data, error } = await admin
    .from('courtesy_codes')
    .insert({
      code,
      plan_code: params.planCode,
      duration_days: durationDays,
      status: 'active',
      note: cleanNote,
      created_by: params.createdBy ?? null,
    })
    .select('*')
    .single()

  if (!error && data) {
    return {
      id: data.id,
      code: data.code,
      planCode: data.plan_code as CourtesyPlanCode,
      planName: getCourtesyPlanLabel(data.plan_code),
      durationDays: data.duration_days,
      status: data.status as CourtesyCodeRecord['status'],
      note: data.note,
      createdBy: data.created_by,
      redeemedBy: data.redeemed_by,
      redeemedAt: data.redeemed_at,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    }
  }

  if (isMissingCourtesyTableError(error)) {
    const payload = {
      code,
      plan_code: params.planCode,
      duration_days: durationDays,
      status: 'active',
      note: cleanNote,
      created_by: params.createdBy ?? null,
      redeemed_by: null,
      redeemed_at: null,
      expires_at: null,
    }
    const { data: notif, error: notifErr } = await admin
      .from('admin_notifications')
      .insert({
        type: 'courtesy_code_record',
        payload,
        is_read: true,
      })
      .select('*')
      .single()

    if (notifErr || !notif) {
      throw new Error(notifErr?.message || 'No se pudo generar el código de cortesía.')
    }

    return {
      id: notif.id,
      code,
      planCode: params.planCode,
      planName: getCourtesyPlanLabel(params.planCode),
      durationDays,
      status: 'active',
      note: cleanNote,
      createdBy: params.createdBy ?? null,
      redeemedBy: null,
      redeemedAt: null,
      expiresAt: null,
      createdAt: notif.created_at || nowIso,
    }
  }

  throw new Error(error?.message || 'No se pudo crear el código de cortesía.')
}

export async function listCourtesyCodes(): Promise<CourtesyCodeRecord[]> {
  const admin = createServiceRoleClient()

  const { data, error } = await admin
    .from('courtesy_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!error && data) {
    return data.map((row) => ({
      id: row.id,
      code: row.code,
      planCode: row.plan_code as CourtesyPlanCode,
      planName: getCourtesyPlanLabel(row.plan_code),
      durationDays: row.duration_days,
      status: row.status as CourtesyCodeRecord['status'],
      note: row.note,
      createdBy: row.created_by,
      redeemedBy: row.redeemed_by,
      redeemedAt: row.redeemed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }))
  }

  if (isMissingCourtesyTableError(error)) {
    const { data: fallbackRows } = await admin
      .from('admin_notifications')
      .select('id, payload, created_at')
      .eq('type', 'courtesy_code_record')
      .order('created_at', { ascending: false })
      .limit(200)

    return (fallbackRows ?? []).map((r) => {
      const p = (r.payload || {}) as Record<string, any>
      const planCode = (p.plan_code || 'solo_monthly') as CourtesyPlanCode
      return {
        id: r.id,
        code: String(p.code || ''),
        planCode,
        planName: getCourtesyPlanLabel(planCode),
        durationDays: Number(p.duration_days || 7),
        status: (p.status || 'active') as CourtesyCodeRecord['status'],
        note: p.note ?? null,
        createdBy: p.created_by ?? null,
        redeemedBy: p.redeemed_by ?? null,
        redeemedAt: p.redeemed_at ?? null,
        expiresAt: p.expires_at ?? null,
        createdAt: r.created_at,
      }
    })
  }

  return []
}

export async function revokeCourtesyCode(codeId: string): Promise<void> {
  const admin = createServiceRoleClient()

  const { error } = await admin
    .from('courtesy_codes')
    .update({ status: 'revoked' })
    .eq('id', codeId)
    .eq('status', 'active')

  if (error && isMissingCourtesyTableError(error)) {
    const { data: existing } = await admin
      .from('admin_notifications')
      .select('id, payload')
      .eq('id', codeId)
      .eq('type', 'courtesy_code_record')
      .maybeSingle()

    if (existing) {
      const payload = { ...((existing.payload as Record<string, any>) || {}), status: 'revoked' }
      await admin.from('admin_notifications').update({ payload }).eq('id', codeId)
    }
    return
  }

  if (error) {
    throw new Error(error.message)
  }
}

export async function validateCourtesyCode(rawCode: string): Promise<{
  ok: boolean
  error?: string
  record?: CourtesyCodeRecord
}> {
  const normalized = (rawCode || '').trim().toUpperCase()
  if (!normalized) {
    return { ok: false, error: 'Introduce un código de cortesía.' }
  }

  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('courtesy_codes')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()

  let record: CourtesyCodeRecord | null = null

  if (!error && data) {
    record = {
      id: data.id,
      code: data.code,
      planCode: data.plan_code as CourtesyPlanCode,
      planName: getCourtesyPlanLabel(data.plan_code),
      durationDays: data.duration_days,
      status: data.status as CourtesyCodeRecord['status'],
      note: data.note,
      createdBy: data.created_by,
      redeemedBy: data.redeemed_by,
      redeemedAt: data.redeemed_at,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    }
  } else if (isMissingCourtesyTableError(error)) {
    const all = await listCourtesyCodes()
    record = all.find((c) => c.code.toUpperCase() === normalized) ?? null
  }

  if (!record) {
    return { ok: false, error: 'El código de cortesía no existe o es inválido.' }
  }

  if (record.status === 'redeemed') {
    return { ok: false, error: 'Este código de cortesía ya fue utilizado.' }
  }

  if (record.status === 'revoked' || record.status === 'expired') {
    return { ok: false, error: 'Este código de cortesía ya no está vigente.' }
  }

  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    return { ok: false, error: 'Este código de cortesía ha expirado.' }
  }

  return { ok: true, record }
}

export async function redeemCourtesyCode(params: {
  code: string
  userId: string
  userEmail?: string | null
}): Promise<{
  ok: boolean
  error?: string
  record?: CourtesyCodeRecord
  periodEnd?: string
}> {
  const validation = await validateCourtesyCode(params.code)
  if (!validation.ok || !validation.record) {
    return { ok: false, error: validation.error || 'Código inválido.' }
  }

  const record = validation.record
  const admin = createServiceRoleClient()

  // 1. Asegurar que el perfil del usuario exista en public.profiles
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', params.userId)
    .maybeSingle()

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: params.userId,
      full_name: params.userEmail?.split('@')[0] || 'Músico',
      preferred_language: 'es',
    })
  }

  // 2. Resolver o crear el plan en public.plans
  let { data: planRow } = await admin
    .from('plans')
    .select('id, code')
    .eq('code', record.planCode)
    .maybeSingle()

  if (!planRow) {
    const planDefinitions: Record<
      CourtesyPlanCode,
      { name: string; plan_type: string; ensemble_type: string | null; price_cents: number; max_members: number | null }
    > = {
      solo_monthly: {
        name: 'Solo',
        plan_type: 'individual',
        ensemble_type: null,
        price_cents: 500,
        max_members: 1,
      },
      band_monthly: {
        name: 'Band (2 a 20 músicos)',
        plan_type: 'organization',
        ensemble_type: 'band',
        price_cents: 6500,
        max_members: 20,
      },
      orchestra_monthly: {
        name: 'Orchestra',
        plan_type: 'organization',
        ensemble_type: 'orchestra',
        price_cents: 9500,
        max_members: null,
      },
    }
    const def = planDefinitions[record.planCode]
    const { data: insertedPlan, error: planErr } = await admin
      .from('plans')
      .insert({
        code: record.planCode,
        name: def.name,
        plan_type: def.plan_type,
        ensemble_type: def.ensemble_type,
        seats_included: def.plan_type === 'individual' ? 1 : 0,
        billing_interval: 'month',
        price_cents: def.price_cents,
        seat_price_cents: 0,
        max_members: def.max_members,
        is_active: true,
      })
      .select('id, code')
      .single()

    if (planErr || !insertedPlan) {
      return { ok: false, error: 'No se pudo resolver el plan asociado al código de cortesía.' }
    }
    planRow = insertedPlan
  }

  // 3. Calcular fin del período de cortesía (7 días)
  const now = new Date()
  const periodEnd = new Date(
    now.getTime() + (record.durationDays || 7) * 24 * 60 * 60 * 1000
  ).toISOString()

  // 4. Registrar suscripción activa por 7 días para el usuario
  const stripeSubId = `courtesy_${record.code}`
  const { error: subErr } = await admin.from('subscriptions').upsert(
    {
      plan_id: planRow.id,
      owner_user_id: params.userId,
      organization_id: null,
      stripe_customer_id: 'courtesy_1m',
      stripe_subscription_id: stripeSubId,
      status: 'active',
      current_period_end: periodEnd,
      cancel_at_period_end: true,
    },
    { onConflict: 'stripe_subscription_id' }
  )

  if (subErr) {
    return { ok: false, error: `Error activando la suscripción de cortesía: ${subErr.message}` }
  }

  // 5. Si es Band u Orchestra, asegurar que el usuario tenga su organización creada
  if (record.planCode === 'band_monthly' || record.planCode === 'orchestra_monthly') {
    const ensembleType = record.planCode === 'band_monthly' ? 'band' : 'orchestra'
    const { data: existingOrg } = await admin
      .from('organizations')
      .select('id')
      .eq('owner_user_id', params.userId)
      .maybeSingle()

    if (!existingOrg) {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: newOrg } = await admin
        .from('organizations')
        .insert({
          owner_user_id: params.userId,
          name: ensembleType === 'band' ? 'Mi Banda' : 'Mi Orquesta',
          ensemble_type: ensembleType,
          max_members: ensembleType === 'band' ? 20 : null,
          invite_code: inviteCode,
        })
        .select('id')
        .maybeSingle()

      if (newOrg) {
        await admin.from('organization_members').insert({
          organization_id: newOrg.id,
          user_id: params.userId,
          role: 'director',
        })
      }
    }
  }

  // 6. Marcar el código como canjeado
  const redeemedAt = now.toISOString()
  const { error: updateErr } = await admin
    .from('courtesy_codes')
    .update({
      status: 'redeemed',
      redeemed_by: params.userId,
      redeemed_at: redeemedAt,
    })
    .eq('id', record.id)

  if (updateErr && isMissingCourtesyTableError(updateErr)) {
    const { data: existingNotif } = await admin
      .from('admin_notifications')
      .select('id, payload')
      .eq('id', record.id)
      .maybeSingle()

    if (existingNotif) {
      const nextPayload = {
        ...((existingNotif.payload as Record<string, any>) || {}),
        status: 'redeemed',
        redeemed_by: params.userId,
        redeemed_at: redeemedAt,
      }
      await admin
        .from('admin_notifications')
        .update({ payload: nextPayload })
        .eq('id', record.id)
    }
  }

  // 7. Emitir notificación en tiempo real para el Panel Admin
  await admin.from('admin_notifications').insert({
    type: 'courtesy_redeemed',
    payload: {
      code: record.code,
      plan_code: record.planCode,
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      period_end: periodEnd,
    },
  })

  return {
    ok: true,
    record: {
      ...record,
      status: 'redeemed',
      redeemedBy: params.userId,
      redeemedAt,
    },
    periodEnd,
  }
}

export * from './vision-providers'
export * from './score-enrichment'


