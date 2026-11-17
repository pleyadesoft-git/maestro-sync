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
