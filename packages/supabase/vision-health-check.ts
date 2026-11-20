import fs from 'fs'
import path from 'path'
import { createServiceRoleClient, getSuperAdminEmails } from './server'
import {
  listActiveVisionProvidersWithSecrets,
  testVisionProviderConnection,
  type VisionProviderType,
} from './vision-providers'

export interface VisionHealthCheckItem {
  id: string
  priority: number
  name: string
  providerType: VisionProviderType
  modelName: string
  ok: boolean
  latencyMs: number
  message: string
}

export interface VisionHealthCheckReport {
  ranAt: string
  totalChecked: number
  okCount: number
  failedCount: number
  results: VisionHealthCheckItem[]
  notificationSaved: boolean
  emailSent: boolean
  emailProvider: 'resend' | 'brevo' | null
  emailRecipients: string[]
  emailError: string | null
}

function readEnvWithFallback(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../../.env'),
      path.resolve(process.cwd(), '../.env'),
      path.resolve(process.cwd(), '.env.local'),
    ]
    const re = new RegExp(`^${key}=(.*)$`, 'm')
    for (const filePath of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8')
        const m = content.match(re)
        if (m && m[1]) return m[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // fallback silencioso
  }
  return undefined
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Obtiene todos los correos de Super-Admins combinando SUPER_ADMIN_BOOTSTRAP_EMAILS
 * y los usuarios marcados con is_platform_admin = true en public.profiles.
 */
async function resolveSuperAdminRecipients(): Promise<string[]> {
  const emailSet = new Set<string>(getSuperAdminEmails())

  try {
    const admin = createServiceRoleClient()
    const { data: adminProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('is_platform_admin', true)

    if (adminProfiles && adminProfiles.length > 0) {
      const lookups = await Promise.all(
        adminProfiles.map((p) => admin.auth.admin.getUserById(p.id).catch(() => null))
      )
      for (const res of lookups) {
        const email = res?.data?.user?.email?.trim().toLowerCase()
        if (email) emailSet.add(email)
      }
    }
  } catch (err) {
    console.warn('[vision-health-check] No se pudieron consultar correos de profiles:', err)
  }

  return Array.from(emailSet)
}

function buildAlertEmailContent(report: {
  ranAt: string
  totalChecked: number
  okCount: number
  failedCount: number
  results: VisionHealthCheckItem[]
}): { subject: string; html: string; text: string } {
  const failed = report.results.filter((r) => !r.ok)
  const passed = report.results.filter((r) => r.ok)
  const allDown = report.okCount === 0 && report.failedCount > 0

  const subject = allDown
    ? `[MaestroSync CRÍTICO] Todos los modelos de Visión IA fallaron (${report.failedCount}/${report.totalChecked})`
    : `[MaestroSync] Alerta Visión IA: ${report.failedCount} de ${report.totalChecked} modelo(s) fallaron`

  const failedRowsHtml = failed
    .map(
      (f) => `
      <div style="background:#1e293b;border:1px solid #f43f5e66;border-radius:10px;padding:14px;margin-bottom:12px;">
        <div style="font-weight:700;color:#fda4af;font-size:14px;">
          #${f.priority} · ${escapeHtml(f.name)}
          <span style="font-weight:400;color:#cbd5e1;font-family:monospace;font-size:12px;">(${escapeHtml(f.providerType)} / ${escapeHtml(f.modelName)})</span>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#94a3b8;">Latencia: ${f.latencyMs} ms</div>
        <pre style="margin:10px 0 0;padding:10px;background:#0b0f17;border-radius:6px;color:#fecdd3;font-size:12px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(f.message)}</pre>
      </div>`
    )
    .join('')

  const passedRowsHtml =
    passed.length > 0
      ? `<h3 style="color:#34d399;font-size:14px;margin:20px 0 8px;">Modelos operativos (${passed.length})</h3>
         <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:13px;">
           ${passed
             .map(
               (p) =>
                 `<li style="margin-bottom:4px;"><strong>#${p.priority} ${escapeHtml(p.name)}</strong> (${escapeHtml(p.modelName)}) — OK (${p.latencyMs} ms)</li>`
             )
             .join('')}
         </ul>`
      : `<p style="color:#fda4af;font-size:13px;font-weight:600;margin-top:16px;">⚠️ Ningún modelo de Visión IA respondió correctamente. El sistema usará únicamente catálogos abiertos (MusicBrainz / OpenOpus) hasta que se corrija al menos un proveedor.</p>`

  const html = `
  <div style="background:#0b0f17;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;border-radius:14px;max-width:680px;margin:0 auto;">
    <div style="border-bottom:1px solid #1e293b;padding-bottom:14px;margin-bottom:18px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#f59e0b;font-weight:700;">MaestroSync · Monitoreo Diario de Visión IA</div>
      <h2 style="margin:6px 0 4px;font-size:20px;color:#ffffff;">Reporte de fallas detectadas (01:00 AM)</h2>
      <div style="font-size:12px;color:#94a3b8;">Ejecutado: ${escapeHtml(report.ranAt)} · Evaluados: ${report.totalChecked} · OK: ${report.okCount} · Con falla: ${report.failedCount}</div>
    </div>

    <h3 style="color:#fb7185;font-size:14px;margin:0 0 10px;">Modelos con falla (${failed.length})</h3>
    ${failedRowsHtml}
    ${passedRowsHtml}

    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #1e293b;font-size:12px;color:#94a3b8;">
      Ingresa al <strong>Panel de Administración → Visión IA (Failover)</strong> para actualizar la API Key, cambiar el nombre del modelo o ajustar el orden de prioridad.
    </div>
  </div>`

  const textLines = [
    `MaestroSync — Chequeo Diario de Visión IA (${report.ranAt})`,
    `Evaluados: ${report.totalChecked} | OK: ${report.okCount} | Con falla: ${report.failedCount}`,
    '',
    'MODELOS CON FALLA:',
    ...failed.map(
      (f) =>
        `- #${f.priority} ${f.name} (${f.providerType} / ${f.modelName}) [${f.latencyMs} ms]:\n  ${f.message}`
    ),
    '',
    ...(passed.length > 0
      ? [
          'MODELOS OPERATIVOS:',
          ...passed.map((p) => `- #${p.priority} ${p.name} (${p.modelName}) — OK (${p.latencyMs} ms)`),
        ]
      : ['ATENCIÓN: Ningún modelo de Visión IA respondió correctamente.']),
  ]

  return { subject, html, text: textLines.join('\n') }
}

async function sendAlertEmail(
  recipients: string[],
  subject: string,
  html: string,
  text: string
): Promise<{ sent: boolean; provider: 'resend' | 'brevo' | null; error: string | null }> {
  if (recipients.length === 0) {
    return { sent: false, provider: null, error: 'No hay correos de Super-Admin configurados.' }
  }

  const resendKey = readEnvWithFallback('RESEND_API_KEY')
  const fromEmail = readEnvWithFallback('ALERT_FROM_EMAIL') || 'MaestroSync Alerts <onboarding@resend.dev>'

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject,
          html,
          text,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { sent: false, provider: 'resend', error: `Resend HTTP ${res.status}: ${body.slice(0, 300)}` }
      }
      return { sent: true, provider: 'resend', error: null }
    } catch (err: any) {
      return { sent: false, provider: 'resend', error: String(err?.message || err) }
    }
  }

  const brevoKey = readEnvWithFallback('BREVO_API_KEY')
  if (brevoKey) {
    try {
      const senderEmail = readEnvWithFallback('ALERT_FROM_EMAIL') || recipients[0]
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender: { name: 'MaestroSync Alerts', email: senderEmail },
          to: recipients.map((email) => ({ email })),
          subject,
          htmlContent: html,
          textContent: text,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { sent: false, provider: 'brevo', error: `Brevo HTTP ${res.status}: ${body.slice(0, 300)}` }
      }
      return { sent: true, provider: 'brevo', error: null }
    } catch (err: any) {
      return { sent: false, provider: 'brevo', error: String(err?.message || err) }
    }
  }

  return {
    sent: false,
    provider: null,
    error: 'Falta configurar RESEND_API_KEY (o BREVO_API_KEY) en el entorno para enviar correos.',
  }
}

/**
 * Prueba todos los proveedores de Visión IA habilitados (1 ping por modelo).
 * Si al menos uno falla:
 *  1) Registra una alerta en public.admin_notifications.
 *  2) Envía un correo con el detalle completo de cada falla a todos los Super-Admins.
 */
export async function runAllVisionProvidersHealthCheck(): Promise<VisionHealthCheckReport> {
  const ranAt = new Date().toISOString()
  const activeProviders = await listActiveVisionProvidersWithSecrets()
  const results: VisionHealthCheckItem[] = []

  for (const p of activeProviders) {
    try {
      const res = await testVisionProviderConnection(p.id)
      results.push({
        id: p.id,
        priority: p.priority,
        name: p.name,
        providerType: p.providerType,
        modelName: p.modelName,
        ok: res.ok,
        latencyMs: res.latencyMs,
        message: res.message,
      })
    } catch (err: any) {
      results.push({
        id: p.id,
        priority: p.priority,
        name: p.name,
        providerType: p.providerType,
        modelName: p.modelName,
        ok: false,
        latencyMs: 0,
        message: String(err?.message || err || 'Error inesperado al probar el proveedor'),
      })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  const failedCount = failed.length

  let notificationSaved = false
  let emailSent = false
  let emailProvider: 'resend' | 'brevo' | null = null
  let emailRecipients: string[] = []
  let emailError: string | null = null

  if (failedCount > 0) {
    // 1. Registrar alerta en admin_notifications para visibilidad inmediata en el Dashboard
    try {
      const admin = createServiceRoleClient()
      await admin.from('admin_notifications').insert({
        type: 'vision_provider_health_alert',
        payload: {
          ran_at: ranAt,
          total_checked: results.length,
          ok_count: okCount,
          failed_count: failedCount,
          failures: failed.map((f) => ({
            priority: f.priority,
            name: f.name,
            provider_type: f.providerType,
            model_name: f.modelName,
            message: f.message,
          })),
        },
      })
      notificationSaved = true
    } catch (err) {
      console.warn('[vision-health-check] No se pudo insertar admin_notifications:', err)
    }

    // 2. Enviar correo a todos los Super-Admins
    emailRecipients = await resolveSuperAdminRecipients()
    const { subject, html, text } = buildAlertEmailContent({
      ranAt,
      totalChecked: results.length,
      okCount,
      failedCount,
      results,
    })

    const mailRes = await sendAlertEmail(emailRecipients, subject, html, text)
    emailSent = mailRes.sent
    emailProvider = mailRes.provider
    emailError = mailRes.error
  }

  return {
    ranAt,
    totalChecked: results.length,
    okCount,
    failedCount,
    results,
    notificationSaved,
    emailSent,
    emailProvider,
    emailRecipients,
    emailError,
  }
}
