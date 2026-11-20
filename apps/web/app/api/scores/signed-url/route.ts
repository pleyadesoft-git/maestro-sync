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

    const body = await req.json()
    const rawFilePath = body?.filePath
    if (!rawFilePath || typeof rawFilePath !== 'string') {
      return NextResponse.json({ ok: false, error: 'filePath es obligatorio' }, { status: 400 })
    }

    const filePath = rawFilePath.trim().replace(/^\/+/, '')
    if (!filePath || filePath.includes('..')) {
      return NextResponse.json({ ok: false, error: 'filePath inválido' }, { status: 400 })
    }

    // Verificar que el archivo pertenece a una partitura registrada y el usuario tiene acceso
    const [{ data: directScores }, { data: pageScores }] = await Promise.all([
      supabase
        .from('scores')
        .select('id, owner_id, work_version_id')
        .eq('file_path', filePath),
      supabase
        .from('score_pages')
        .select('scores ( id, owner_id, work_version_id )')
        .eq('image_path', filePath),
    ])

    const matchedScores: Array<{ id: string; owner_id: string; work_version_id: string }> = []
    if (directScores) {
      for (const s of directScores) {
        if (s?.id) matchedScores.push(s)
      }
    }
    if (pageScores) {
      for (const p of pageScores as any[]) {
        const s = Array.isArray(p?.scores) ? p.scores[0] : p?.scores
        if (s?.id && !matchedScores.some((m) => m.id === s.id)) {
          matchedScores.push(s)
        }
      }
    }

    if (matchedScores.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permiso para acceder a este archivo.' },
        { status: 403 }
      )
    }

    let isAuthorized = matchedScores.some((s) => s.owner_id === user.id)

    if (!isAuthorized) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.is_platform_admin) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const workVersionIds = Array.from(
        new Set(matchedScores.map((s) => s.work_version_id).filter(Boolean))
      )

      if (workVersionIds.length > 0) {
        const { data: activeSessions } = await supabase
          .from('sessions')
          .select('id, director_user_id')
          .in('work_version_id', workVersionIds)
          .neq('status', 'ended')

        if (activeSessions && activeSessions.length > 0) {
          if (activeSessions.some((sess) => sess.director_user_id === user.id)) {
            isAuthorized = true
          } else {
            const sessionIds = activeSessions.map((sess) => sess.id)
            const { data: participation } = await supabase
              .from('session_participants')
              .select('id')
              .in('session_id', sessionIds)
              .eq('user_id', user.id)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()

            if (participation) {
              isAuthorized = true
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permiso para acceder a esta partitura.' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase.storage.from('scores').createSignedUrl(filePath, 7200)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'No se pudo generar la URL firmada' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, signedUrl: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al obtener URL firmada' },
      { status: 500 }
    )
  }
}
