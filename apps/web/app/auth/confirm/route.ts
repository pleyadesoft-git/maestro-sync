import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/es/library'

  if (token_hash && type) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}/es/login?error=missing_env`)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && data.user) {
      // Asegurar que exista el perfil en public.profiles
      try {
        const admin = createServiceRoleClient()
        const defaultName =
          data.user.user_metadata?.full_name ||
          data.user.email?.split('@')[0] ||
          'Usuario'

        await admin.from('profiles').upsert({
          id: data.user.id,
          full_name: defaultName,
          preferred_language: 'es',
          is_platform_admin: false,
        })
      } catch {
        /* fallback silencioso */
      }

      // Redirigir a la biblioteca con mensaje de bienvenida
      const targetUrl = new URL(next, origin)
      targetUrl.searchParams.set('confirmed', 'true')
      return NextResponse.redirect(targetUrl.toString())
    }

    // Redirigir al login con mensaje amigable de error
    const loginUrl = new URL('/es/login', origin)
    loginUrl.searchParams.set('error', 'token_expired')
    if (error?.message) {
      loginUrl.searchParams.set('details', error.message)
    }
    return NextResponse.redirect(loginUrl.toString())
  }

  // Si no hay token_hash, redirigir a login
  return NextResponse.redirect(`${origin}/es/login`)
}
