'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, CardHeader, CardTitle, CardDescription, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import {
  ArrowLeft,
  Save,
  Trash2,
  RotateCcw,
  Play,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Music,
  FileText,
} from 'lucide-react'
import { createRoomForVersion } from '../../../../lib/rooms'
import LanguageSwitcher from '../../../components/LanguageSwitcher'

const KEY_SIGNATURES = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'Bb major', 'F major',
  'A minor', 'E minor', 'B minor', 'F# minor', 'D minor', 'G minor', 'C minor',
]

const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '2/2', '3/8', '12/8']

export default function WorkDetailPage({ params }: { params: Promise<{ locale: string; workId: string }> }) {
  const routeParams = useParams<{ locale?: string; workId?: string }>()
  const locale = routeParams?.locale ?? 'es'
  const workId = routeParams?.workId ?? ''
  const t = useTranslations('workDetail')
  const tKeys = useTranslations('keySignatures')
  const router = useRouter()
  const supabase = createBrowserClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Datos de la obra
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [catalogRef, setCatalogRef] = useState('')
  const [keySignature, setKeySignature] = useState('C major')
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [tempo, setTempo] = useState(120)
  const [totalMeasures, setTotalMeasures] = useState(64)

  // Metadatos asociados
  const [versionId, setVersionId] = useState<string | null>(null)
  const [scoreId, setScoreId] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState<number>(1)
  const [parts, setParts] = useState<Array<{ id: string; name: string }>>([])
  const [systemsCount, setSystemsCount] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    const loadWorkDetails = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData.user) {
          router.push(`/${locale}/login`)
          return
        }

        const { data: work, error: workError } = await (supabase as any)
          .from('works')
          .select(`
            id, title, composer, catalog_reference, key_signature, time_signature, default_tempo_bpm, total_measures,
            work_versions (
              id, version_name, tempo_bpm_override, total_measures_override,
              scores ( id, file_path, file_type, page_count, status ),
              parts ( id, name, part_order )
            )
          `)
          .eq('id', workId)
          .single()

        if (cancelled) return
        if (workError || !work) {
          throw new Error(t('notFound'))
        }

        setTitle(work.title || '')
        setComposer(work.composer || '')
        setCatalogRef(work.catalog_reference || '')
        setKeySignature(work.key_signature || 'C major')
        setTimeSignature(work.time_signature || '4/4')
        setTempo(work.default_tempo_bpm || 120)
        setTotalMeasures(work.total_measures || 32)

        const firstVersion = work.work_versions?.[0]
        if (firstVersion) {
          setVersionId(firstVersion.id)
          setParts(firstVersion.parts || [])

          const firstScore = firstVersion.scores?.[0]
          if (firstScore) {
            setScoreId(firstScore.id)
            setFilePath(firstScore.file_path)
            setPageCount(firstScore.page_count || 1)

            // Contar sistemas asociados
            const { count } = await (supabase as any)
              .from('score_systems')
              .select('id', { count: 'exact', head: true })
              .in(
                'score_page_id',
                (
                  await supabase
                    .from('score_pages')
                    .select('id')
                    .eq('score_id', firstScore.id)
                ).data?.map((p: any) => p.id) || []
              )
            setSystemsCount(count || 0)
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatusMessage({ type: 'error', text: err?.message || t('loadError') })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadWorkDetails()
    return () => {
      cancelled = true
    }
  }, [workId, supabase, router, locale, t])

  const handleSaveChanges = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    if (!e.currentTarget.checkValidity()) {
      return
    }
    setStatusMessage(null)
    setSaving(true)

    try {
      const { error: workErr } = await (supabase as any)
        .from('works')
        .update({
          title: title.trim(),
          composer: composer.trim() || null,
          catalog_reference: catalogRef.trim() || null,
          key_signature: keySignature,
          time_signature: timeSignature,
          default_tempo_bpm: tempo,
          total_measures: totalMeasures,
        })
        .eq('id', workId)

      if (workErr) throw new Error(workErr.message)

      if (versionId) {
        await (supabase as any)
          .from('work_versions')
          .update({
            tempo_bpm_override: tempo,
            total_measures_override: totalMeasures,
          })
          .eq('id', versionId)
      }

      setStatusMessage({ type: 'success', text: t('saveSuccess') })
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || t('saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleResetMarkup = async () => {
    if (!scoreId) return
    const confirmed = window.confirm(t('confirmResetMarkup'))
    if (!confirmed) return

    setResetting(true)
    setStatusMessage(null)
    try {
      const { error } = await supabase.rpc('reset_score_markup', {
        p_score_id: scoreId,
      })

      if (error) throw new Error(error.message)
      setSystemsCount(0)
      setStatusMessage({
        type: 'success',
        text: t('resetMarkupSuccess'),
      })
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || t('resetMarkupError') })
    } finally {
      setResetting(false)
    }
  }

  const handleDeleteEntireWork = async () => {
    const confirmed = window.confirm(t('confirmDeleteWork'))
    if (!confirmed) return

    setDeleting(true)
    setStatusMessage(null)
    try {
      if (filePath) {
        await supabase.storage.from('scores').remove([filePath])
      }
      const { error } = await supabase.from('works').delete().eq('id', workId)
      if (error) throw new Error(error.message)

      router.push(`/${locale}/library`)
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || t('deleteWorkError') })
      setDeleting(false)
    }
  }

  const handleStartSession = async () => {
    if (!versionId) return
    setStarting(true)
    setStatusMessage(null)
    try {
      const result = await createRoomForVersion(supabase, versionId, tempo)
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.message })
        return
      }
      router.push(`/${locale}/session/${result.roomCode}`)
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || t('startSessionError') })
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-sm">{t('loading')}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header de navegación */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/${locale}/library`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('backToLibrary')}</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleStartSession}
              disabled={starting}
              className="gap-1.5"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{t('startLiveRehearsal')}</span>
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={`flex items-start gap-2.5 p-4 rounded-xl text-sm border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveChanges} noValidate className="space-y-6">
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>{t('editCardTitle')}</span>
              </CardTitle>
              <CardDescription>
                {t('editCardDesc')}
              </CardDescription>
            </CardHeader>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('workTitleLabel')}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <Input
                  label={t('composerLabel')}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder={t('composerPlaceholder')}
                />

                <Input
                  label={t('catalogRefLabel')}
                  value={catalogRef}
                  onChange={(e) => setCatalogRef(e.target.value)}
                  placeholder={t('catalogRefPlaceholder')}
                />

                <Input
                  label={t('tempoLabel')}
                  type="number"
                  min={30}
                  max={320}
                  required
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                />

                <div className="space-y-1.5">
                  <label htmlFor="keySigSelect" className="block text-sm font-medium text-slate-300">
                    {t('keySignatureLabel')}
                  </label>
                  <select
                    id="keySigSelect"
                    value={keySignature}
                    onChange={(e) => setKeySignature(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm appearance-none"
                  >
                    {KEY_SIGNATURES.map((k) => (
                      <option key={k} value={k}>
                        {tKeys.has(k) ? tKeys(k) : k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="timeSigSelect" className="block text-sm font-medium text-slate-300">
                    {t('timeSignatureLabel')}
                  </label>
                  <select
                    id="timeSigSelect"
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm appearance-none"
                  >
                    {TIME_SIGNATURES.map((ts) => (
                      <option key={ts} value={ts}>
                        {ts}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label={t('totalMeasuresLabel')}
                  type="number"
                  min={1}
                  max={9999}
                  required
                  value={totalMeasures}
                  onChange={(e) => setTotalMeasures(Number(e.target.value))}
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">{t('registeredPagesLabel')}</label>
                  <div className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center text-sm font-semibold">
                    {t('pagesSummary', { pages: pageCount, systems: systemsCount })}
                  </div>
                </div>
              </div>

              {/* Partes / Instrumentos */}
              {parts.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-amber-400" />
                    {t('assignedParts', { count: parts.length })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parts.map((p) => (
                      <span key={p.id} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-300 font-medium">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button type="submit" variant="primary" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{t('saveChanges')}</span>
                </Button>
              </div>
            </div>
          </Card>
        </form>

        {/* Zona de Peligro y Acciones Estructurales */}
        <Card className="border-rose-500/20 bg-rose-950/5">
          <CardHeader>
            <CardTitle className="text-base text-rose-300 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>{t('dangerTitle')}</span>
            </CardTitle>
            <CardDescription>
              {t('dangerDesc')}
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">{t('resetMarkupTitle')}</p>
              <p className="text-xs text-slate-400">
                {t('resetMarkupDescBefore')} <strong>{t('resetMarkupDescBold')}</strong> {t('resetMarkupDescAfter')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetMarkup}
              disabled={resetting || systemsCount === 0}
              className="border-slate-700 text-amber-400 hover:border-amber-500 shrink-0"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
              <span>{t('resetMarkupButton')}</span>
            </Button>
          </div>

          <div className="p-6 pt-4 border-t border-rose-500/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-300">{t('deleteWorkTitle')}</p>
              <p className="text-xs text-slate-400">
                {t('deleteWorkDesc')}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteEntireWork}
              disabled={deleting}
              className="shrink-0"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              <span>{t('deleteWorkButton')}</span>
            </Button>
          </div>
        </Card>
      </div>
    </main>
  )
}
