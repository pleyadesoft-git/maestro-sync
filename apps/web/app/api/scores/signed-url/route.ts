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
    const { filePath } = body
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ ok: false, error: 'filePath es obligatorio' }, { status: 400 })
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
