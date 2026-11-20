'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, Button } from '@music-flow/ui'
import {
  listVisionProvidersAction,
  createVisionProviderAction,
  updateVisionProviderAction,
  deleteVisionProviderAction,
  reorderVisionProvidersAction,
  testVisionProviderAction,
  runVisionHealthCheckAction,
  type VisionProviderRecord,
  type VisionProviderType,
} from '../admin-actions'
import {
  Sparkles,
  Plus,
  GripVertical,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Zap,
  ArrowUp,
  ArrowDown,
  Power,
  Eye,
  EyeOff,
  X,
  Check,
  Database,
} from 'lucide-react'

interface ProviderPresetUI {
  providerType: VisionProviderType
  label: string
  badge: string
  defaultName: string
  defaultModel: string
  defaultBaseUrl: string
  freeTierInfo: string
  apiKeyUrl: string
  docsUrl: string
}

const PROVIDER_PRESETS: ProviderPresetUI[] = [
  {
    providerType: 'gemini',
    label: 'Google Gemini (AI Studio)',
    badge: 'Recomendado',
    defaultName: 'Gemini 3.5 Flash-Lite (Free)',
    defaultModel: 'gemini-3.5-flash-lite',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    freeTierInfo: 'Tier gratuito sin tarjeta; súper rápido y multimodal (visión nativa).',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  {
    providerType: 'zhipu',
    label: 'Zhipu AI / BigModel (China)',
    badge: 'Gratis',
    defaultName: 'Zhipu GLM-4V-Flash (Gratis)',
    defaultModel: 'glm-4v-flash',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    freeTierInfo: 'Gratis sin costo por token (limitado por concurrencia). Compatible con OpenAI.',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
  },
  {
    providerType: 'qwen',
    label: 'Alibaba Model Studio / Qwen-VL (China)',
    badge: '1M Gratis',
    defaultName: 'Alibaba Qwen-VL-Plus',
    defaultModel: 'qwen-vl-plus',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    freeTierInfo: '1,000,000 tokens gratis por modelo (180 días). Excelente OCR musical/texto.',
    apiKeyUrl: 'https://modelstudio.console.alibabacloud.com/?tab=model#/api-key',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/vision',
  },
  {
    providerType: 'openrouter',
    label: 'OpenRouter (:free)',
    badge: 'Agregador',
    defaultName: 'OpenRouter Free Vision',
    defaultModel: 'openrouter/free',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    freeTierInfo: 'Enruta automáticamente a modelos de visión :free ($0, ~50–200 req/día).',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    docsUrl: 'https://openrouter.ai/models?max_price=0&modality=text%2Bimage-%3Etext',
  },
  {
    providerType: 'openai',
    label: 'OpenAI (GPT-4o-mini)',
    badge: 'Pago bajo',
    defaultName: 'OpenAI GPT-4o-mini',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    freeTierInfo: 'Prepago desde $5 USD (~$0.15 / 1M tokens). Muy estable en producción.',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/guides/vision',
  },
  {
    providerType: 'openai_compatible',
    label: 'Personalizado (OpenAI Compatible)',
    badge: 'Custom',
    defaultName: 'Proveedor Vision Custom',
    defaultModel: '',
    defaultBaseUrl: '',
    freeTierInfo: 'Cualquier servidor/API compatible con /chat/completions (ej. vLLM, Ollama, Fireworks).',
    apiKeyUrl: '',
    docsUrl: '',
  },
]

interface Props {
  getToken: () => Promise<string | null>
}

interface FormErrors {
  name?: string
  modelName?: string
  apiKey?: string
  baseUrl?: string
}

export function VisionProvidersManager({ getToken }: Props) {
  const [providers, setProviders] = useState<VisionProviderRecord[]>([])
  const [tableMissing, setTableMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Modal / Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [providerType, setProviderType] = useState<VisionProviderType>('gemini')
  const [name, setName] = useState('Gemini 3.5 Flash-Lite (Free)')
  const [modelName, setModelName] = useState('gemini-3.5-flash-lite')
  const [baseUrl, setBaseUrl] = useState('https://generativelanguage.googleapis.com/v1beta')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [notes, setNotes] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Per-item busy states
  const [testingId, setTestingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [runningHealthCheck, setRunningHealthCheck] = useState(false)

  // Drag & Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await listVisionProvidersAction(token)
      setProviders(res.providers)
      setTableMissing(res.tableMissing)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar los proveedores de Visión IA.')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token || cancelled) return
        const res = await listVisionProvidersAction(token)
        if (!cancelled) {
          setProviders(res.providers)
          setTableMissing(res.tableMissing)
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Error al cargar los proveedores de Visión IA.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  const applyPreset = (type: VisionProviderType) => {
    const preset = PROVIDER_PRESETS.find((p) => p.providerType === type)
    setProviderType(type)
    if (preset) {
      if (!editingId) {
        setName(preset.defaultName)
      }
      setModelName(preset.defaultModel)
      setBaseUrl(preset.defaultBaseUrl)
    }
    setFormErrors({})
  }

  const openCreateForm = (presetType: VisionProviderType = 'gemini') => {
    const preset = PROVIDER_PRESETS.find((p) => p.providerType === presetType) ?? PROVIDER_PRESETS[0]
    setEditingId(null)
    setProviderType(preset.providerType)
    setName(preset.defaultName)
    setModelName(preset.defaultModel)
    setBaseUrl(preset.defaultBaseUrl)
    setApiKey('')
    setShowApiKey(false)
    setNotes('')
    setIsEnabled(true)
    setFormErrors({})
    setShowForm(true)
  }

  const openEditForm = (p: VisionProviderRecord) => {
    setEditingId(p.id)
    setProviderType(p.providerType)
    setName(p.name)
    setModelName(p.modelName)
    setBaseUrl(p.baseUrl || '')
    setApiKey('')
    setShowApiKey(false)
    setNotes(p.notes || '')
    setIsEnabled(p.isEnabled)
    setFormErrors({})
    setShowForm(true)
  }

  const validateForm = (): boolean => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Ingresa un nombre descriptivo para identificar este modelo.'
    if (!modelName.trim()) errs.modelName = 'Ingresa el identificador del modelo (ej. gemini-2.5-flash-lite).'
    if (!editingId && !apiKey.trim()) {
      errs.apiKey = 'La API Key es obligatoria al crear un proveedor.'
    }
    if (providerType === 'openai_compatible' && !baseUrl.trim()) {
      errs.baseUrl = 'La URL base es obligatoria para proveedores personalizados.'
    }
    if (baseUrl.trim() && !/^https?:\/\//i.test(baseUrl.trim())) {
      errs.baseUrl = 'La URL base debe comenzar con http:// o https://'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return

      if (editingId) {
        const updated = await updateVisionProviderAction(token, editingId, {
          name: name.trim(),
          providerType,
          modelName: modelName.trim(),
          baseUrl: baseUrl.trim() || null,
          apiKey: apiKey.trim() || undefined,
          notes: notes.trim() || null,
          isEnabled,
        })
        setProviders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        setFeedback({ type: 'ok', text: `Proveedor "${updated.name}" actualizado correctamente.` })
      } else {
        const created = await createVisionProviderAction(token, {
          name: name.trim(),
          providerType,
          modelName: modelName.trim(),
          baseUrl: baseUrl.trim() || null,
          apiKey: apiKey.trim(),
          notes: notes.trim() || null,
          isEnabled,
        })
        setProviders((prev) => [...prev, created])
        setFeedback({ type: 'ok', text: `Proveedor "${created.name}" agregado en prioridad #${created.priority}.` })
      }
      setShowForm(false)
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'No se pudo guardar el proveedor.' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (p: VisionProviderRecord) => {
    setTogglingId(p.id)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return
      const updated = await updateVisionProviderAction(token, p.id, { isEnabled: !p.isEnabled })
      setProviders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'No se pudo cambiar el estado.' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return
      await deleteVisionProviderAction(token, id)
      setConfirmDeleteId(null)
      await loadProviders()
      setFeedback({ type: 'ok', text: 'Proveedor eliminado y prioridades reordenadas.' })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'No se pudo eliminar el proveedor.' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleTest = async (p: VisionProviderRecord) => {
    setTestingId(p.id)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await testVisionProviderAction(token, p.id)
      if (res.provider) {
        setProviders((prev) => prev.map((item) => (item.id === res.provider!.id ? res.provider! : item)))
      }
      setFeedback({
        type: res.ok ? 'ok' : 'error',
        text: `${p.name}: ${res.message}`,
      })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Error al probar conexión.' })
    } finally {
      setTestingId(null)
    }
  }

  const handleRunHealthCheck = async () => {
    setRunningHealthCheck(true)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return
      const report = await runVisionHealthCheckAction(token)
      await loadProviders()
      if (report.failedCount === 0) {
        setFeedback({
          type: 'ok',
          text: `Health Check completado: ${report.okCount}/${report.totalChecked} modelos respondieron OK.`,
        })
      } else {
        const mailInfo = report.emailSent
          ? `Correo de alerta enviado a ${report.emailRecipients.join(', ')} (${report.emailProvider}).`
          : `Alerta registrada en el panel. Correo no enviado: ${report.emailError || 'sin proveedor de email'}`
        setFeedback({
          type: 'error',
          text: `Health Check: ${report.failedCount} de ${report.totalChecked} modelo(s) fallaron. ${mailInfo}`,
        })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Error ejecutando el Health Check.' })
    } finally {
      setRunningHealthCheck(false)
    }
  }

  const persistOrder = async (nextList: VisionProviderRecord[]) => {
    // Optimistic UI update
    const renumbered = nextList.map((item, idx) => ({ ...item, priority: idx + 1 }))
    setProviders(renumbered)
    setReordering(true)
    setFeedback(null)
    try {
      const token = await getToken()
      if (!token) return
      const saved = await reorderVisionProvidersAction(
        token,
        renumbered.map((item) => item.id)
      )
      setProviders(saved)
      setFeedback({ type: 'ok', text: 'Orden de prioridad guardado. El failover usará este orden.' })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'No se pudo guardar el nuevo orden.' })
      await loadProviders()
    } finally {
      setReordering(false)
    }
  }

  const handleDropOn = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const fromIdx = providers.findIndex((p) => p.id === draggedId)
    const toIdx = providers.findIndex((p) => p.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const next = [...providers]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)

    setDraggedId(null)
    setDragOverId(null)
    await persistOrder(next)
  }

  const handleMoveStep = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= providers.length) return
    const next = [...providers]
    const [moved] = next.splice(index, 1)
    next.splice(targetIdx, 0, moved)
    await persistOrder(next)
  }

  const activePreset = PROVIDER_PRESETS.find((p) => p.providerType === providerType)

  return (
    <div className="space-y-6">
      {/* Banner si falta la migración SQL */}
      {tableMissing && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-start gap-3">
          <Database className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">Migración pendiente en Supabase</p>
            <p className="mt-1 text-amber-100/80">
              Ejecuta el archivo <code className="rounded bg-slate-900 px-1.5 py-0.5 text-amber-300">supabase/migrations/0005_vision_providers.sql</code> en el SQL Editor de Supabase para habilitar el guardado de proveedores de Visión IA.
            </p>
          </div>
        </div>
      )}

      {/* Encabezado y guía rápida de links */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Proveedores de Visión IA (Failover por Prioridad)
            </CardTitle>
            <CardDescription className="mt-1">
              Al subir una partitura (PDF o imagen), MaestroSync probará el proveedor #1; si falla o alcanza su límite, pasará automáticamente al #2, #3, etc., y complementará con MusicBrainz / OpenOpus / IMSLP.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={handleRunHealthCheck}
              disabled={tableMissing || runningHealthCheck || providers.length === 0}
              title="Prueba todos los modelos habilitados y envía correo a los Super-Admins si alguno falla"
            >
              {runningHealthCheck ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Probando todos...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2 text-amber-400" />
                  Probar Todos (Health Check)
                </>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={() => openCreateForm('gemini')}
              disabled={tableMissing}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Proveedor IA
            </Button>
          </div>
        </CardHeader>

        {/* Tarjetas rápidas de enlaces para obtener API Keys */}
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Accesos rápidos para obtener API Keys (Gratis / Bajo costo)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {PROVIDER_PRESETS.filter((p) => p.apiKeyUrl).map((preset) => (
              <div
                key={preset.providerType}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex flex-col justify-between gap-2 hover:border-amber-500/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-100 truncate">{preset.label}</span>
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">{preset.freeTierInfo}</p>
                  <p className="mt-1.5 text-[11px] font-mono text-slate-300 truncate" title={preset.defaultModel}>
                    Modelo: {preset.defaultModel}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <a
                    href={preset.apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300"
                  >
                    Obtener Key <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openCreateForm(preset.providerType)}
                    disabled={tableMissing}
                    className="text-[11px] font-medium text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    + Usar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Formulario Crear / Editar */}
      {showForm && (
        <Card className="border-amber-500/40 bg-slate-900/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{editingId ? 'Editar Proveedor de Visión IA' : 'Nuevo Proveedor de Visión IA'}</CardTitle>
              <CardDescription>
                La API Key se almacena de forma segura en PostgreSQL con acceso exclusivo de servidor (RLS + service_role).
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Cerrar formulario"
            >
              <X className="h-5 w-5" />
            </button>
          </CardHeader>

          <form onSubmit={handleSubmit} noValidate className="px-6 pb-6 space-y-4">
            {/* Selector de tipo de proveedor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Proveedor (VISION_PROVIDER)
                </label>
                <select
                  value={providerType}
                  onChange={(e) => applyPreset(e.target.value as VisionProviderType)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.providerType} value={p.providerType}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {activePreset?.apiKeyUrl && (
                  <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-2">
                    <a
                      href={activePreset.apiKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                    >
                      Abrir consola de API Key <ExternalLink className="h-3 w-3" />
                    </a>
                    {activePreset.docsUrl && (
                      <>
                        <span>·</span>
                        <a
                          href={activePreset.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-white inline-flex items-center gap-1"
                        >
                          Documentación <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nombre visible
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  placeholder="Ej. Gemini 2.5 Flash-Lite (Free)"
                  className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    formErrors.name
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {formErrors.name}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Modelo (VISION_MODEL)
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => {
                    setModelName(e.target.value)
                    if (formErrors.modelName) setFormErrors((prev) => ({ ...prev, modelName: undefined }))
                  }}
                  placeholder="Ej. gemini-2.5-flash-lite, glm-4v-flash, qwen-vl-plus"
                  className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    formErrors.modelName
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
                  }`}
                />
                {formErrors.modelName && (
                  <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {formErrors.modelName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  URL Base (Endpoint)
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value)
                    if (formErrors.baseUrl) setFormErrors((prev) => ({ ...prev, baseUrl: undefined }))
                  }}
                  placeholder="https://open.bigmodel.cn/api/paas/v4"
                  className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    formErrors.baseUrl
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
                  }`}
                />
                {formErrors.baseUrl && (
                  <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {formErrors.baseUrl}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  API Key (VISION_API_KEY) {editingId && <span className="normal-case text-slate-400">(dejar vacía para conservar la actual)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      if (formErrors.apiKey) setFormErrors((prev) => ({ ...prev, apiKey: undefined }))
                    }}
                    placeholder={editingId ? '•••••••••••• (sin cambios)' : 'Pega aquí tu API Key'}
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 pr-10 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                      formErrors.apiKey
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30'
                        : 'border-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    aria-label={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formErrors.apiKey && (
                  <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {formErrors.apiKey}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Notas internas (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Cuenta gratuita principal, límite 20 req/min"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-amber-500"
                />
                Habilitado en la cadena de failover automático
              </label>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : editingId ? (
                    'Guardar Cambios'
                  ) : (
                    'Guardar Proveedor'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Lista ordenable con Drag & Drop */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Cadena de Failover ({providers.length} {providers.length === 1 ? 'modelo' : 'modelos'})
            </CardTitle>
            <CardDescription>
              Arrastra las filas (<GripVertical className="inline h-3.5 w-3.5 text-slate-400" />) o usa las flechas para ordenar del <strong>más recomendado (#1)</strong> al último respaldo.
            </CardDescription>
          </div>
          {reordering && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando orden...
            </span>
          )}
        </CardHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              Cargando proveedores...
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
              <Sparkles className="h-8 w-8 text-amber-400/70 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-200">
                Aún no hay proveedores de Visión IA configurados
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Agrega uno o varios proveedores (por ejemplo Gemini Free como #1 y Zhipu GLM-4V-Flash como #2). Mientras tanto, la app usará MusicBrainz, OpenOpus e IMSLP automáticamente.
              </p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => openCreateForm('gemini')}
                disabled={tableMissing}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer proveedor
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p, index) => {
                const isDragging = draggedId === p.id
                const isDragOver = dragOverId === p.id && draggedId !== p.id

                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(p.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', p.id)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverId !== p.id) setDragOverId(p.id)
                    }}
                    onDragLeave={() => {
                      if (dragOverId === p.id) setDragOverId(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleDropOn(p.id)
                    }}
                    onDragEnd={() => {
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                    className={`rounded-xl border p-4 transition-all ${
                      isDragOver
                        ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30 scale-[1.01]'
                        : isDragging
                          ? 'opacity-50 border-slate-600 bg-slate-900'
                          : p.isEnabled
                            ? 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                            : 'border-slate-800/60 bg-slate-950/30 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Izquierda: Drag handle + Prioridad + Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="mt-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 transition-colors"
                          title="Arrastra para reordenar"
                        >
                          <GripVertical className="h-5 w-5" />
                        </div>

                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                              index === 0 && p.isEnabled
                                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            #{p.priority}
                          </span>
                          {index === 0 && (
                            <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                              Principal
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-white truncate">{p.name}</h4>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-amber-300">
                              {p.providerType}
                            </span>
                            <span className="rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                              {p.modelName}
                            </span>
                            {p.lastStatus === 'ok' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            )}
                            {p.lastStatus === 'error' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">
                                <XCircle className="h-3 w-3" /> Error
                              </span>
                            )}
                            {!p.isEnabled && (
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                                Deshabilitado
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span className="font-mono">Key: {p.apiKeyMasked}</span>
                            <span>
                              Éxitos: <strong className="text-emerald-400">{p.successCount}</strong> · Fallos:{' '}
                              <strong className="text-rose-400">{p.failureCount}</strong>
                            </span>
                            {p.notes && <span className="text-slate-300">· {p.notes}</span>}
                          </div>

                          {p.lastError && (
                            <p className="mt-1.5 text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1 line-clamp-2">
                              Último error: {p.lastError}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Derecha: Controles */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {/* Botones accesibles Subir/Bajar */}
                        <button
                          type="button"
                          onClick={() => handleMoveStep(index, -1)}
                          disabled={index === 0 || reordering}
                          title="Subir prioridad"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(index, 1)}
                          disabled={index === providers.length - 1 || reordering}
                          title="Bajar prioridad"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>

                        {/* Probar conexión */}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleTest(p)}
                          disabled={testingId === p.id}
                          className="text-xs px-3 py-1.5 h-auto"
                        >
                          {testingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                          )}
                          Probar
                        </Button>

                        {/* Activar / Desactivar */}
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(p)}
                          disabled={togglingId === p.id}
                          title={p.isEnabled ? 'Deshabilitar' : 'Habilitar'}
                          className={`rounded-lg border p-2 transition-colors ${
                            p.isEnabled
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {togglingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => openEditForm(p)}
                          title="Editar proveedor"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-amber-500/40 hover:text-amber-400"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Eliminar con confirmación inline */}
                        {confirmDeleteId === p.id ? (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1">
                            <span className="text-[11px] text-rose-200 mr-1">¿Borrar?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              disabled={deletingId === p.id}
                              className="rounded bg-rose-600 p-1 text-white hover:bg-rose-500"
                              title="Confirmar eliminación"
                            >
                              {deletingId === p.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded bg-slate-800 p-1 text-slate-300 hover:text-white"
                              title="Cancelar"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            title="Eliminar proveedor"
                            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
