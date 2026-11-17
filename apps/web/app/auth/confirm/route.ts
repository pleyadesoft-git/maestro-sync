import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSuperAdminEmail } from '@music-flow/supabase/server'
import { getPublicOrigin, resolveSafeRedirectUrl } from '@music-flow/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const publicOrigin = getPublicOrigin(request, 3002)
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/es/library'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${publicOrigin}/es/login?error=missing_env`)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  let authedUser: any = null

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error && data.user) {
      authedUser = data.user
    } else {
      const loginUrl = new URL('/es/login', publicOrigin)
      loginUrl.searchParams.set('error', 'token_expired')
      if (error?.message) {
        loginUrl.searchParams.set('details', error.message)
      }
      return NextResponse.redirect(loginUrl.toString())
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      authedUser = data.user
    } else {
      const loginUrl = new URL('/es/login', publicOrigin)
      loginUrl.searchParams.set('error', 'oauth_error')
      if (error?.message) {
        loginUrl.searchParams.set('details', error.message)
      }
      return NextResponse.redirect(loginUrl.toString())
    }
  }

  if (authedUser) {
    try {
      const admin = createServiceRoleClient()
      const defaultName =
        authedUser.user_metadata?.full_name ||
        authedUser.user_metadata?.name ||
        authedUser.email?.split('@')[0] ||
        'Usuario'

      const isSuper = isSuperAdminEmail(authedUser.email)

      const { data: existingProfile } = await admin
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', authedUser.id)
        .maybeSingle()

      if (!existingProfile) {
        await admin.from('profiles').insert({
          id: authedUser.id,
          full_name: defaultName,
          preferred_language: 'es',
          is_platform_admin: isSuper,
        })
      } else if (isSuper && !existingProfile.is_platform_admin) {
        await admin.from('profiles').update({ is_platform_admin: true }).eq('id', authedUser.id)
      }
    } catch {
      /* fallback silencioso */
    }

    const targetUrl = resolveSafeRedirectUrl(next, publicOrigin, '/es/library')
    targetUrl.searchParams.set('confirmed', 'true')
    return NextResponse.redirect(targetUrl.toString())
  }

  // Si no hay token_hash ni code, redirigir a login
  return NextResponse.redirect(`${publicOrigin}/es/login`)
}
