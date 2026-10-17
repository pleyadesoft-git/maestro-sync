import { NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@music-flow/supabase'

export interface StoredPasskey {
  id: string // base64url credential ID
  publicKey: string // base64url encoded public key
  counter: number
  deviceType?: string
  backedUp?: boolean
  transports?: string[]
  name?: string
  createdAt: string
  lastUsedAt?: string
}

export interface WebAuthnChallengeCookie {
  challenge: string
  type: 'register' | 'login'
  email?: string
  userId?: string
  timestamp: number
}

export const WEBAUTHN_COOKIE_NAME = 'mf_webauthn_challenge'

/**
 * Deriva de forma dinámica la configuración de Relying Party (rpID, rpName, origin)
 * a partir de la petición HTTP, compatible con localhost, túneles y dominios en producción.
 */
export function getWebAuthnConfig(req: NextRequest) {
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'localhost:3002'

  // El rpID en WebAuthn debe ser el hostname SIN puerto
  const rpID = host.split(':')[0]

  const proto =
    req.headers.get('x-forwarded-proto') ||
    (rpID === 'localhost' || rpID === '127.0.0.1' ? 'http' : 'https')

  const originHeader = req.headers.get('origin')
  const origin = originHeader || `${proto}://${host}`

  return {
    rpID,
    rpName: 'MaestroSync',
    origin,
  }
}

/**
 * Encuentra a un usuario por email buscando en auth.users mediante Service Role.
 */
export async function findUserByEmail(
  supabaseAdmin: SupabaseClient<Database>,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error || !data?.users) return null
  const users = data.users as User[]
  return users.find((u: User) => u.email?.toLowerCase() === normalized) || null
}

/**
 * Encuentra a un usuario que posea la Passkey (credentialID) registrada en sus metadatos.
 */
export async function findUserByPasskeyId(
  supabaseAdmin: SupabaseClient<Database>,
  passkeyId: string
): Promise<{ user: User; passkey: StoredPasskey } | null> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error || !data?.users) return null

  for (const user of data.users) {
    const passkeys = (user.user_metadata?.passkeys || []) as StoredPasskey[]
    const found = passkeys.find((pk) => pk.id === passkeyId)
    if (found) {
      return { user, passkey: found }
    }
  }

  return null
}

/**
 * Guarda o actualiza una passkey en los metadatos del usuario.
 * Si el usuario no existe, lo crea en auth.users con email_confirm: true y
 * genera su fila correspondiente en public.profiles.
 */
export async function savePasskeyToUser(
  supabaseAdmin: SupabaseClient<Database>,
  params: {
    user?: User | null
    email: string
    fullName?: string
    passkey: StoredPasskey
  }
): Promise<{ user: User; isNewUser: boolean }> {
  const normalizedEmail = params.email.trim().toLowerCase()
  let targetUser = params.user || (await findUserByEmail(supabaseAdmin, normalizedEmail))

  if (!targetUser) {
    // Crear nuevo usuario confirmado biometría directa
    const displayName = params.fullName?.trim() || normalizedEmail.split('@')[0]
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          passkeys: [params.passkey],
        },
      })

    if (createError || !created?.user) {
      throw new Error(
        `Error al crear usuario para Passkey: ${createError?.message || 'Desconocido'}`
      )
    }

    targetUser = created.user

    // Asegurar perfil en public.profiles
    await supabaseAdmin.from('profiles').upsert({
      id: targetUser.id,
      full_name: displayName,
      preferred_language: 'es',
      is_platform_admin: false,
    })

    return { user: targetUser, isNewUser: true }
  }

  // Usuario existente: agregar o actualizar passkey
  const existingPasskeys = (targetUser.user_metadata?.passkeys || []) as StoredPasskey[]
  const filtered = existingPasskeys.filter((pk) => pk.id !== params.passkey.id)
  filtered.push(params.passkey)

  const { data: updated, error: updateError } =
    await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      user_metadata: {
        ...targetUser.user_metadata,
        passkeys: filtered,
      },
    })

  if (updateError || !updated?.user) {
    throw new Error(
      `Error al vincular Passkey a usuario: ${updateError?.message || 'Desconocido'}`
    )
  }

  // Asegurar que el perfil exista
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', targetUser.id)
    .maybeSingle()

  if (!profile) {
    const displayName =
      params.fullName?.trim() ||
      targetUser.user_metadata?.full_name ||
      normalizedEmail.split('@')[0]
    await supabaseAdmin.from('profiles').upsert({
      id: targetUser.id,
      full_name: displayName,
      preferred_language: 'es',
      is_platform_admin: false,
    })
  }

  return { user: updated.user, isNewUser: false }
}

/**
 * Actualiza el contador y último uso de una passkey tras login exitoso.
 */
export async function updatePasskeyUsage(
  supabaseAdmin: SupabaseClient<Database>,
  userId: string,
  passkeyId: string,
  newCounter: number
): Promise<void> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !data?.user) return

  const passkeys = (data.user.user_metadata?.passkeys || []) as StoredPasskey[]
  const updated = passkeys.map((pk) => {
    if (pk.id === passkeyId) {
      return {
        ...pk,
        counter: newCounter,
        lastUsedAt: new Date().toISOString(),
      }
    }
    return pk
  })

  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...data.user.user_metadata,
      passkeys: updated,
    },
  })
}
