import { NextRequest, NextResponse } from 'next/server'
import { validateCourtesyCode } from '@music-flow/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const code = typeof body?.code === 'string' ? body.code : ''

    const result = await validateCourtesyCode(code)
    if (!result.ok || !result.record) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Código de cortesía inválido.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      code: result.record.code,
      planCode: result.record.planCode,
      planName: result.record.planName,
      durationDays: result.record.durationDays,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error al validar el código de cortesía.' },
      { status: 500 }
    )
  }
}
