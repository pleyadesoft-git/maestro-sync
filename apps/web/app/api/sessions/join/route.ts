import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Debes iniciar sesión para unirte a la sala.' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Sesión inválida.' }, { status: 401 })
    }

    const body = await req.json()
    const rawCode = (body.roomCode || '').toString().trim().toUpperCase()
    if (!rawCode) {
      return NextResponse.json({ ok: false, error: 'Código de sala no proporcionado.' }, { status: 400 })
    }

    // Asegurar perfil
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, is_suspended')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        preferred_language: 'es',
        is_platform_admin: false,
      })
    } else if (existingProfile.is_suspended) {
      return NextResponse.json({ ok: false, error: 'Tu cuenta está suspendida.' }, { status: 403 })
    }

    // Buscar sesión
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_code', rawCode)
      .maybeSingle()

    if (sessionErr || !session) {
      return NextResponse.json(
        { ok: false, error: `La sala «${rawCode}» no existe o ya ha finalizado.` },
        { status: 404 }
      )
    }

    // Si es el director de la sala, su rol se mantiene como director, sino performer
    const role = session.director_user_id === user.id ? 'director' : 'performer'

    await supabase.from('session_participants').upsert(
      {
        session_id: session.id,
        user_id: user.id,
        role,
        is_active: true,
        left_at: null,
      },
      { onConflict: 'session_id,user_id' }
    )

    return NextResponse.json({
      ok: true,
      session,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al unirse a la sala.' },
      { status: 500 }
    )
  }
}
