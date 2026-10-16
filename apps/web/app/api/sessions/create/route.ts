import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let part1 = ''
  let part2 = ''
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  for (let i = 0; i < 2; i++) {
    part2 += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${part1}-${part2}`
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Debes iniciar sesión.' }, { status: 401 })
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
    const { workVersionId, tempoBpm } = body
    if (!workVersionId) {
      return NextResponse.json({ ok: false, error: 'workVersionId es requerido.' }, { status: 400 })
    }

    // Asegurar perfil
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        preferred_language: 'es',
        is_platform_admin: false,
      })
    }

    // Verificar pertenencia de la obra
    const { data: versionData, error: versionErr } = await supabase
      .from('work_versions')
      .select('id, work_id, works ( owner_id )')
      .eq('id', workVersionId)
      .maybeSingle()

    if (versionErr || !versionData) {
      return NextResponse.json({ ok: false, error: 'Versión de obra no encontrada.' }, { status: 404 })
    }

    const ownerId = (versionData.works as any)?.owner_id
    if (ownerId && ownerId !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permiso para crear sala con esta obra.' },
        { status: 403 }
      )
    }

    // Generar room code único
    let roomCode = generateRoomCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('room_code', roomCode)
        .maybeSingle()
      if (!existing) break
      roomCode = generateRoomCode()
      attempts++
    }

    const tempo = Math.min(300, Math.max(1, Math.round(Number(tempoBpm) || 100)))

    // Insertar sesión
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        room_code: roomCode,
        work_version_id: workVersionId,
        director_user_id: user.id,
        status: 'waiting',
        tempo_bpm: tempo,
        current_measure: 1,
      })
      .select('*')
      .single()

    if (sessionErr || !session) {
      throw new Error(sessionErr?.message || 'No se pudo crear la sala.')
    }

    // Registrar al director como participante
    await supabase.from('session_participants').upsert(
      {
        session_id: session.id,
        user_id: user.id,
        role: 'director',
        is_active: true,
      },
      { onConflict: 'session_id,user_id' }
    )

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        room_code: session.room_code,
        work_version_id: session.work_version_id,
        director_user_id: session.director_user_id,
        status: session.status,
        tempo_bpm: session.tempo_bpm,
        current_measure: session.current_measure,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al crear la sala.' },
      { status: 500 }
    )
  }
}
