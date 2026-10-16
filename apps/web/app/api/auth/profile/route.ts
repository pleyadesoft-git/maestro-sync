import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, profile: existing })
    }

    const defaultName =
      user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: defaultName,
        preferred_language: 'es',
        is_platform_admin: false,
      })
      .select('*')
      .single()

    if (createError) {
      return NextResponse.json({ ok: false, error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: created })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al sincronizar perfil' },
      { status: 500 }
    )
  }
}
