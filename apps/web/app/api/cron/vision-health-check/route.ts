import { NextRequest, NextResponse } from 'next/server'
import { runAllVisionProvidersHealthCheck } from '@music-flow/supabase/server'

export const maxDuration = 60

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    // En desarrollo local sin CRON_SECRET se permite solo si no es producción
    return process.env.NODE_ENV !== 'production'
  }
  const authHeader = req.headers.get('authorization')?.trim() || ''
  return authHeader === `Bearer ${cronSecret}`
}

async function handleHealthCheck(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized cron request' }, { status: 401 })
  }

  try {
    const report = await runAllVisionProvidersHealthCheck()
    return NextResponse.json({
      ok: true,
      ...report,
    })
  } catch (err: any) {
    console.error('[cron/vision-health-check] Error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Error ejecutando health check de Visión IA.' },
      { status: 500 }
    )
  }
}

// Vercel Cron invoca GET por defecto
export async function GET(req: NextRequest) {
  return handleHealthCheck(req)
}

// También soportamos POST para schedulers externos (GitHub Actions, cron-job.org, etc.)
export async function POST(req: NextRequest) {
  return handleHealthCheck(req)
}
