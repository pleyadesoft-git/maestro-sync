import { createServiceRoleClient } from './server'

export type VisionProviderType =
  | 'gemini'
  | 'zhipu'
  | 'qwen'
  | 'openrouter'
  | 'openai'
  | 'openai_compatible'

export type VisionProviderStatus = 'untested' | 'ok' | 'error'

export interface VisionProviderRecord {
  id: string
  name: string
  providerType: VisionProviderType
  baseUrl: string | null
  modelName: string
  apiKeyMasked: string
  priority: number
  isEnabled: boolean
  notes: string | null
  lastStatus: VisionProviderStatus
  lastError: string | null
  lastTestedAt: string | null
  successCount: number
  failureCount: number
  createdAt: string
  updatedAt: string
}

export interface VisionProviderSecretRecord extends VisionProviderRecord {
  apiKey: string
}

export interface CreateVisionProviderInput {
  name: string
  providerType: VisionProviderType
  baseUrl?: string | null
  modelName: string
  apiKey: string
  isEnabled?: boolean
  notes?: string | null
  createdBy?: string | null
}

export interface UpdateVisionProviderInput {
  name?: string
  providerType?: VisionProviderType
  baseUrl?: string | null
  modelName?: string
  apiKey?: string // Si viene vacío o undefined, se conserva la clave actual
  isEnabled?: boolean
  notes?: string | null
}

export interface VisionProviderPreset {
  providerType: VisionProviderType
  label: string
  defaultName: string
  defaultModel: string
  defaultBaseUrl: string
  freeTierInfo: string
  apiKeyUrl: string
  docsUrl: string
}

export const VISION_PROVIDER_PRESETS: VisionProviderPreset[] = [
  {
    providerType: 'gemini',
    label: 'Google Gemini (AI Studio)',
    defaultName: 'Gemini 2.5 Flash-Lite (Free)',
    defaultModel: 'gemini-2.5-flash-lite',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    freeTierInfo: 'Tier gratuito sin tarjeta; pago ~$0.10 / 1M tokens',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  {
    providerType: 'zhipu',
    label: 'Zhipu AI / BigModel (China)',
    defaultName: 'Zhipu GLM-4V-Flash (Gratis)',
    defaultModel: 'glm-4v-flash',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    freeTierInfo: 'Gratis (sin costo por token, limitado por concurrencia)',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
  },
  {
    providerType: 'qwen',
    label: 'Alibaba Model Studio / Qwen-VL (China)',
    defaultName: 'Qwen-VL-Plus (Alibaba)',
    defaultModel: 'qwen-vl-plus',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    freeTierInfo: '1,000,000 tokens gratis por modelo (180 días)',
    apiKeyUrl: 'https://modelstudio.console.alibabacloud.com/?tab=model#/api-key',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/vision',
  },
  {
    providerType: 'openrouter',
    label: 'OpenRouter (Agregador :free)',
    defaultName: 'OpenRouter Free Vision',
    defaultModel: 'openrouter/free',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    freeTierInfo: 'Modelos :free a $0 (límite diario ~50–200 req/día)',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    docsUrl: 'https://openrouter.ai/models?max_price=0&modality=text%2Bimage-%3Etext',
  },
  {
    providerType: 'openai',
    label: 'OpenAI (GPT-4o-mini)',
    defaultName: 'OpenAI GPT-4o-mini',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    freeTierInfo: 'Prepago desde $5 USD (~$0.15 / 1M tokens)',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/guides/vision',
  },
  {
    providerType: 'openai_compatible',
    label: 'Personalizado (OpenAI Compatible)',
    defaultName: 'Proveedor Vision Personalizado',
    defaultModel: '',
    defaultBaseUrl: '',
    freeTierInfo: 'Cualquier endpoint compatible con /chat/completions',
    apiKeyUrl: '',
    docsUrl: '',
  },
]

export function maskApiKey(key: string): string {
  const clean = (key || '').trim()
  if (!clean) return '••••'
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`
}

export function resolveProviderBaseUrl(
  providerType: VisionProviderType,
  customBaseUrl?: string | null
): string {
  const trimmed = (customBaseUrl || '').trim().replace(/\/+$/, '')
  if (trimmed) return trimmed
  const preset = VISION_PROVIDER_PRESETS.find((p) => p.providerType === providerType)
  return (preset?.defaultBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
}

function isMissingVisionTableError(error: any): boolean {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('ai_vision_providers') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found')))
  )
}

function mapRowToMasked(row: any): VisionProviderRecord {
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type as VisionProviderType,
    baseUrl: row.base_url ?? null,
    modelName: row.model_name,
    apiKeyMasked: maskApiKey(row.api_key),
    priority: Number(row.priority) || 1,
    isEnabled: Boolean(row.is_enabled),
    notes: row.notes ?? null,
    lastStatus: (row.last_status as VisionProviderStatus) || 'untested',
    lastError: row.last_error ?? null,
    lastTestedAt: row.last_tested_at ?? null,
    successCount: Number(row.success_count) || 0,
    failureCount: Number(row.failure_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listVisionProviders(): Promise<{
  providers: VisionProviderRecord[]
  tableMissing: boolean
}> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('ai_vision_providers')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingVisionTableError(error)) {
      return { providers: [], tableMissing: true }
    }
    throw new Error(`No se pudieron listar los proveedores de visión: ${error.message}`)
  }

  return {
    providers: (data ?? []).map(mapRowToMasked),
    tableMissing: false,
  }
}

export async function listActiveVisionProvidersWithSecrets(): Promise<VisionProviderSecretRecord[]> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('ai_vision_providers')
    .select('*')
    .eq('is_enabled', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingVisionTableError(error)) {
      return []
    }
    throw new Error(`No se pudieron cargar los proveedores activos: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    ...mapRowToMasked(row),
    apiKey: row.api_key,
  }))
}

export async function createVisionProvider(
  input: CreateVisionProviderInput
): Promise<VisionProviderRecord> {
  const admin = createServiceRoleClient()

  const { data: existing, error: listErr } = await admin
    .from('ai_vision_providers')
    .select('priority')
    .order('priority', { ascending: false })
    .limit(1)

  if (listErr) {
    if (isMissingVisionTableError(listErr)) {
      throw new Error(
        'La tabla ai_vision_providers aún no existe en Supabase. Ejecuta la migración supabase/migrations/0005_vision_providers.sql.'
      )
    }
    throw new Error(listErr.message)
  }

  const nextPriority = existing && existing.length > 0 ? Number(existing[0].priority) + 1 : 1
  const resolvedBaseUrl =
    input.baseUrl?.trim() ||
    resolveProviderBaseUrl(input.providerType, null)

  const { data, error } = await admin
    .from('ai_vision_providers')
    .insert({
      name: input.name.trim(),
      provider_type: input.providerType,
      base_url: resolvedBaseUrl,
      model_name: input.modelName.trim(),
      api_key: input.apiKey.trim(),
      priority: nextPriority,
      is_enabled: input.isEnabled ?? true,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`No se pudo crear el proveedor: ${error?.message || 'Error desconocido'}`)
  }

  return mapRowToMasked(data)
}

export async function updateVisionProvider(
  id: string,
  updates: UpdateVisionProviderInput
): Promise<VisionProviderRecord> {
  const admin = createServiceRoleClient()

  const payload: Record<string, any> = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.providerType !== undefined) payload.provider_type = updates.providerType
  if (updates.baseUrl !== undefined) {
    payload.base_url = updates.baseUrl?.trim() || null
  }
  if (updates.modelName !== undefined) payload.model_name = updates.modelName.trim()
  if (updates.apiKey !== undefined && updates.apiKey.trim().length > 0) {
    payload.api_key = updates.apiKey.trim()
  }
  if (updates.isEnabled !== undefined) payload.is_enabled = updates.isEnabled
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null

  const { data, error } = await admin
    .from('ai_vision_providers')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`No se pudo actualizar el proveedor: ${error?.message || 'No encontrado'}`)
  }

  return mapRowToMasked(data)
}

export async function deleteVisionProvider(id: string): Promise<void> {
  const admin = createServiceRoleClient()
  const { error } = await admin.from('ai_vision_providers').delete().eq('id', id)
  if (error) {
    throw new Error(`No se pudo eliminar el proveedor: ${error.message}`)
  }

  // Re-normalizar prioridades 1..N
  const { data: remaining } = await admin
    .from('ai_vision_providers')
    .select('id')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (remaining && remaining.length > 0) {
    await Promise.all(
      remaining.map((row, idx) =>
        admin.from('ai_vision_providers').update({ priority: idx + 1 }).eq('id', row.id)
      )
    )
  }
}

export async function reorderVisionProviders(orderedIds: string[]): Promise<VisionProviderRecord[]> {
  const admin = createServiceRoleClient()
  const cleanIds = orderedIds.filter(Boolean)

  await Promise.all(
    cleanIds.map((id, idx) =>
      admin.from('ai_vision_providers').update({ priority: idx + 1 }).eq('id', id)
    )
  )

  const { providers } = await listVisionProviders()
  return providers
}

export async function recordVisionProviderResult(
  id: string,
  ok: boolean,
  errorMessage?: string | null
): Promise<void> {
  const admin = createServiceRoleClient()
  const { data: current } = await admin
    .from('ai_vision_providers')
    .select('success_count, failure_count')
    .eq('id', id)
    .maybeSingle()

  if (!current) return

  await admin
    .from('ai_vision_providers')
    .update({
      last_status: ok ? 'ok' : 'error',
      last_error: ok ? null : (errorMessage || 'Error desconocido').slice(0, 500),
      last_tested_at: new Date().toISOString(),
      success_count: ok ? (current.success_count || 0) + 1 : current.success_count || 0,
      failure_count: ok ? current.failure_count || 0 : (current.failure_count || 0) + 1,
    })
    .eq('id', id)
}

export async function testVisionProviderConnection(id: string): Promise<{
  ok: boolean
  latencyMs: number
  message: string
  provider?: VisionProviderRecord
}> {
  const admin = createServiceRoleClient()
  const { data: row, error } = await admin
    .from('ai_vision_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !row) {
    throw new Error('Proveedor no encontrado.')
  }

  const startedAt = Date.now()
  const providerType = row.provider_type as VisionProviderType
  const baseUrl = resolveProviderBaseUrl(providerType, row.base_url)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    if (providerType === 'gemini') {
      const url = `${baseUrl}/models/${encodeURIComponent(row.model_name)}:generateContent?key=${encodeURIComponent(row.api_key)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with exactly: OK' }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 },
        }),
        signal: controller.signal,
      })

      const latencyMs = Date.now() - startedAt
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        const msg = `HTTP ${res.status}: ${errText.slice(0, 220)}`
        await recordVisionProviderResult(id, false, msg)
        const { data: updated } = await admin.from('ai_vision_providers').select('*').eq('id', id).maybeSingle()
        return { ok: false, latencyMs, message: msg, provider: updated ? mapRowToMasked(updated) : undefined }
      }

      await recordVisionProviderResult(id, true, null)
      const { data: updated } = await admin.from('ai_vision_providers').select('*').eq('id', id).maybeSingle()
      return {
        ok: true,
        latencyMs,
        message: `Conexión exitosa con ${row.model_name} (${latencyMs} ms)`,
        provider: updated ? mapRowToMasked(updated) : undefined,
      }
    }

    // Proveedores compatibles con OpenAI (Zhipu, Qwen, OpenRouter, OpenAI, Custom)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${row.api_key}`,
    }
    if (providerType === 'openrouter') {
      headers['HTTP-Referer'] = 'https://maestrosync.app'
      headers['X-Title'] = 'MaestroSync'
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: row.model_name,
        messages: [{ role: 'user', content: 'Respond with exactly: OK' }],
        max_tokens: 16,
        temperature: 0,
      }),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startedAt
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const msg = `HTTP ${res.status}: ${errText.slice(0, 220)}`
      await recordVisionProviderResult(id, false, msg)
      const { data: updated } = await admin.from('ai_vision_providers').select('*').eq('id', id).maybeSingle()
      return { ok: false, latencyMs, message: msg, provider: updated ? mapRowToMasked(updated) : undefined }
    }

    await recordVisionProviderResult(id, true, null)
    const { data: updated } = await admin.from('ai_vision_providers').select('*').eq('id', id).maybeSingle()
    return {
      ok: true,
      latencyMs,
      message: `Conexión exitosa con ${row.model_name} (${latencyMs} ms)`,
      provider: updated ? mapRowToMasked(updated) : undefined,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt
    const msg =
      err?.name === 'AbortError'
        ? 'Tiempo de espera agotado (15s)'
        : String(err?.message || err || 'Error de red')
    await recordVisionProviderResult(id, false, msg)
    const { data: updated } = await admin.from('ai_vision_providers').select('*').eq('id', id).maybeSingle()
    return { ok: false, latencyMs, message: msg, provider: updated ? mapRowToMasked(updated) : undefined }
  } finally {
    clearTimeout(timeout)
  }
}
