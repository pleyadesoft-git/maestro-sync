import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, enrichScoreMetadata } from '@music-flow/supabase/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Debes iniciar sesión para analizar partituras.' },
        { status: 401 }
      )
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token)

    if (authErr || !user) {
      return NextResponse.json(
        { ok: false, error: 'Sesión inválida o expirada.' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const images = Array.isArray(body?.images)
      ? body.images.filter((x: unknown) => typeof x === 'string').slice(0, 2)
      : []

    const hints = {
      title: typeof body?.hints?.title === 'string' ? body.hints.title : undefined,
      composer: typeof body?.hints?.composer === 'string' ? body.hints.composer : undefined,
      fileName: typeof body?.hints?.fileName === 'string' ? body.hints.fileName : undefined,
    }

    const result = await enrichScoreMetadata({ images, hints })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[enrich-metadata] Error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'No se pudo enriquecer la metadata.' },
      { status: 500 }
    )
  }
}
