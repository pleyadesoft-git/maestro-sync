import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

let cachedClient: SupabaseClient<Database> | null = null

/**
 * Cliente Supabase para el navegador. Singleton: devuelve SIEMPRE la misma
 * instancia para que identidades estables en `useEffect([supabase])` no
 * re-suscriban canales Realtime en cada render.
 */
export function createBrowserClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[music-flow] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores.'
    )
  }

  cachedClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

/**
 * Cliente con el access token de un usuario concreto (para Server Actions).
 * Usa la anon key + Authorization del usuario, de modo que RLS aplica con su
 * identidad. No contiene claves de servicio: es seguro en el servidor.
 */
export function createAuthedClient(accessToken: string): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[music-flow] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
