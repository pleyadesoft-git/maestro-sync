'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, HighlightOverlay, Input, MusicScoreSheet } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { processScoreFile, type ProcessedScoreOutput } from '@/lib/scoreProcessor'
import type { DetectedPage, ScoreAnalysisResult } from '@music-flow/score-analysis'
import {
  Upload,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  Music,
} from 'lucide-react'

const KEY_SIGNATURES = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'Bb major', 'F major',
  'A minor', 'E minor', 'B minor', 'F# minor', 'D minor', 'G minor', 'C minor',
]

const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '2/2', '3/8', '12/8']

export default function UploadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const supabase = createBrowserClient()

  const [step, setStep] = useState<'meta' | 'mark'>('meta')
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [catalogRef, setCatalogRef] = useState('')
  const [keySignature, setKeySignature] = useState('C major')
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [tempo, setTempo] = useState(120)
  const [totalMeasures, setTotalMeasures] = useState(64)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'musicxml'>('pdf')

  // Estado del análisis automático
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStage, setAnalysisStage] = useState('')
  const [analysisResult, setAnalysisResult] = useState<ScoreAnalysisResult | null>(null)
  const [autoDetectedBadge, setAutoDetectedBadge] = useState<string | null>(null)

  // Páginas renderizadas y navegación
  const [pageImages, setPageImages] = useState<Array<{ pageNumber: number; dataUrl: string; width: number; height: number }>>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pagesData, setPagesData] = useState<DetectedPage[]>([])
  const [activeSystemId, setActiveSystemId] = useState<string>('sys-1')
  const [viewMode, setViewMode] = useState<'uploaded' | 'digital'>('uploaded')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const fileRef = useRef<File | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user)
      setAuthChecked(true)
    })
  }, [supabase])

  // Obtener los sistemas de la página actualmente visible
  const activePageObj = pagesData.find((p) => p.pageNumber === currentPage)
  const currentSystems = activePageObj?.systems || []

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      fileRef.current = selectedFile
      setFileName(selectedFile.name)
      setFileError(null)
      setSaveError(null)
      setIsAnalyzing(true)
      setAnalysisProgress(10)
      setAnalysisStage('Iniciando lectura del archivo...')

      try {
        const output: ProcessedScoreOutput = await processScoreFile(selectedFile, (stage, prog) => {
          setAnalysisStage(stage)
          setAnalysisProgress(prog)
        })

        setFileType(output.fileType)
        setAnalysisResult(output.analysis)
        setPageImages(output.pageImages)
        setCurrentPage(1)

        // Rellenar automáticamente los metadatos detectados
        if (output.analysis.title) setTitle(output.analysis.title)
        if (output.analysis.composer) setComposer(output.analysis.composer)
        if (output.analysis.catalogRef) setCatalogRef(output.analysis.catalogRef)
        if (output.analysis.keySignature) setKeySignature(output.analysis.keySignature)
        if (output.analysis.timeSignature) setTimeSignature(output.analysis.timeSignature)
        if (output.analysis.tempoBpm) setTempo(output.analysis.tempoBpm)
        if (output.analysis.totalMeasures) setTotalMeasures(output.analysis.totalMeasures)

        // Asignar sistemas detectados
        if (output.analysis.pages && output.analysis.pages.length > 0) {
          setPagesData(output.analysis.pages)
        }

        const confPct = Math.round((output.analysis.confidence.metadata * 0.4 + output.analysis.confidence.layout * 0.6) * 100)
        setAutoDetectedBadge(`Detección automática completada (${confPct}% de confianza)`)
        setViewMode('uploaded')
      } catch (err: any) {
        console.warn('Error en análisis automático:', err)
        setFileError(err?.message || 'No se pudo analizar automáticamente el archivo. Puedes ingresar los datos manualmente.')
      } finally {
        setIsAnalyzing(false)
      }
    }
  }

  const handleAddSystem = () => {
    const lastMeasure = currentSystems.length > 0
      ? currentSystems[currentSystems.length - 1].measureStart + currentSystems[currentSystems.length - 1].measureCount
      : 1

    const newSysOrder = currentSystems.length + 1
    const bboxY = Math.min(0.85, 0.12 + (newSysOrder - 1) * 0.18)

    const newSystem = {
      systemOrder: newSysOrder,
      measureStart: lastMeasure,
      measureCount: 4,
      bboxX: 0.04,
      bboxY,
      bboxW: 0.92,
      bboxH: 0.14,
      staves: [
        {
          staffOrder: 1,
          bboxX: 0.04,
          bboxY: bboxY + 0.02,
          bboxW: 0.92,
          bboxH: 0.1,
          partName: 'Todos',
          confidence: 1.0,
        },
      ],
      measures: [
        { measureNumber: lastMeasure, xStart: 0.04, xEnd: 0.27 },
        { measureNumber: lastMeasure + 1, xStart: 0.27, xEnd: 0.5 },
        { measureNumber: lastMeasure + 2, xStart: 0.5, xEnd: 0.73 },
        { measureNumber: lastMeasure + 3, xStart: 0.73, xEnd: 0.96 },
      ],
      confidence: 1.0,
    }

    setPagesData((prev) =>
      prev.map((p) => {
        if (p.pageNumber === currentPage) {
          return { ...p, systems: [...p.systems, newSystem] }
        }
        return p
      })
    )
  }

  const handleRemoveSystem = (systemOrder: number) => {
    setPagesData((prev) =>
      prev.map((p) => {
        if (p.pageNumber === currentPage) {
          return { ...p, systems: p.systems.filter((s) => s.systemOrder !== systemOrder) }
        }
        return p
      })
    )
  }

  const handleUpdateSystem = (systemOrder: number, updates: Partial<(typeof currentSystems)[0]>) => {
    setPagesData((prev) =>
      prev.map((p) => {
        if (p.pageNumber === currentPage) {
          return {
            ...p,
            systems: p.systems.map((s) => (s.systemOrder === systemOrder ? { ...s, ...updates } : s)),
          }
        }
        return p
      })
    )
  }

  const handleSaveScore = async () => {
    if (isSaving) return
    setSaveError(null)

    const file = fileRef.current
    if (!file) {
      setSaveError('Selecciona el archivo de la partitura en el paso 1.')
      setStep('meta')
      return
    }
    if (!title.trim()) {
      setSaveError('El título de la obra es obligatorio.')
      setStep('meta')
      return
    }

    setIsSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setSaveError('Debes iniciar sesión para guardar la partitura en tu biblioteca.')
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      formData.append('composer', composer.trim())
      if (catalogRef.trim()) formData.append('catalogRef', catalogRef.trim())
      formData.append('keySignature', keySignature)
      formData.append('timeSignature', timeSignature)
      formData.append('tempo', String(tempo))
      formData.append('totalMeasures', String(totalMeasures))
      formData.append('pageCount', String(Math.max(1, pagesData.length || pageImages.length || 1)))

      // Partes detectadas
      const parts = analysisResult?.parts && analysisResult.parts.length > 0
        ? analysisResult.parts
        : [{ name: 'Todos', partOrder: 1, deskCount: 1 }]
      formData.append('parts', JSON.stringify(parts))

      // Páginas, sistemas, staves y measures
      formData.append('pages', JSON.stringify(pagesData))

      // Mapa de repeticiones y saltos
      if (analysisResult?.playbackMap && analysisResult.playbackMap.length > 0) {
        formData.append('playbackMap', JSON.stringify(analysisResult.playbackMap))
      }

      // Imágenes de las páginas renderizadas en canvas
      if (pageImages.length > 0) {
        formData.append('pageImages', JSON.stringify(pageImages.map((p) => ({ pageNumber: p.pageNumber, dataUrl: p.dataUrl }))))
      }

      const res = await fetch('/api/scores/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo guardar la partitura.')
      }

      router.push(`/${locale}/library`)
    } catch (e: any) {
      setSaveError(e?.message || 'No se pudo guardar la partitura.')
    } finally {
      setIsSaving(false)
    }
  }

  const activePageImage = pageImages.find((p) => p.pageNumber === currentPage)?.dataUrl

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto">
        <Link href={`/${locale}/library`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Biblioteca</span>
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Subida y Análisis de Partituras</h1>
            <p className="text-sm text-slate-400">
              {step === 'meta'
                ? 'Paso 1: Detección Automática de Metadata y Archivo'
                : 'Paso 2: Asistente Visual de Pentagramas y Compases'}
            </p>
          </div>
          {autoDetectedBadge && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {autoDetectedBadge}
            </span>
          )}
        </div>

        {step === 'meta' ? (
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle>1. Carga Inteligente de la Obra</CardTitle>
              <CardDescription>
                Sube tu archivo PDF, Imagen o MusicXML. El sistema detectará automáticamente páginas, compases y sistemas.
              </CardDescription>
            </CardHeader>

            {authChecked && !currentUser && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Inicia sesión para guardar en tu biblioteca</p>
                    <p className="text-xs text-amber-400/80">
                      Disfrutas de 15 días de prueba gratuita completa. Podrás preparar y revisar tu partitura sin restricciones.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/${locale}/login`}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                </div>
              </div>
            )}

            {saveError && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/20 px-4 py-3 text-xs font-medium text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                let hasError = false

                if (!fileName) {
                  setFileError('Por favor selecciona una partitura en PDF, Imagen o MusicXML para continuar')
                  hasError = true
                }
                if (!title.trim()) {
                  hasError = true
                }

                if (!hasError) {
                  setStep('mark')
                }
              }}
              className="space-y-6"
            >
              {/* File Upload Box */}
              <div>
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${
                    fileError
                      ? 'border-rose-500/80 bg-rose-950/15 hover:border-rose-400 shadow-sm shadow-rose-950/40'
                      : 'border-slate-800 hover:border-amber-500/50 bg-slate-900/50'
                  }`}
                >
                  <input
                    type="file"
                    accept="application/pdf,image/*,.xml,.musicxml"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${fileError ? 'text-rose-400' : 'text-amber-500'}`} />
                  <p className="text-sm font-semibold text-slate-200">
                    {fileName ? fileName : 'Haz clic o arrastra tu partitura en PDF, Imagen o MusicXML'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Soporta PDF multipágina, escaneos JPG/PNG y archivos MusicXML (.xml, .musicxml)
                  </p>
                </div>

                {isAnalyzing && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{analysisStage}</span>
                        <span className="text-amber-400 font-mono">{analysisProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                          style={{ width: `${analysisProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {fileError && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-rose-400 mt-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{fileError}</span>
                  </p>
                )}
              </div>

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Título de la Obra"
                  required
                  placeholder="ej. Sinfonía No. 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  helperText={autoDetectedBadge ? 'Detectado automáticamente' : undefined}
                />

                <Input
                  label="Compositor"
                  placeholder="ej. L. van Beethoven"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  helperText={composer ? 'Detectado automáticamente' : undefined}
                />

                <Input
                  label="Referencia de Catálogo"
                  placeholder="ej. Op. 67 / BWV 1007"
                  value={catalogRef}
                  onChange={(e) => setCatalogRef(e.target.value)}
                  helperText="Opus, BWV, K. u otro catálogo"
                />

                <Input
                  label="Tempo Base (BPM)"
                  type="number"
                  min={30}
                  max={320}
                  required
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  helperText="Velocidad metronómica"
                />

                <div className="space-y-1.5">
                  <label htmlFor="keySignature" className="block text-sm font-medium text-slate-300">
                    Tonalidad
                  </label>
                  <select
                    id="keySignature"
                    value={keySignature}
                    onChange={(e) => setKeySignature(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 text-sm appearance-none"
                  >
                    {KEY_SIGNATURES.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="timeSignature" className="block text-sm font-medium text-slate-300">
                    Compás
                  </label>
                  <select
                    id="timeSignature"
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 text-sm appearance-none"
                  >
                    {TIME_SIGNATURES.map((ts) => (
                      <option key={ts} value={ts}>
                        {ts}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Total de Compases"
                  type="number"
                  min={1}
                  max={9999}
                  required
                  value={totalMeasures}
                  onChange={(e) => setTotalMeasures(Number(e.target.value))}
                  helperText="Compases de la obra completa"
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">Páginas Detectadas</label>
                  <div className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center text-sm font-semibold">
                    {Math.max(1, pagesData.length || pageImages.length || 1)} {pagesData.length === 1 ? 'página' : 'páginas'}
                  </div>
                </div>
              </div>

              {/* Instrumentos / Partes detectadas */}
              {analysisResult?.parts && analysisResult.parts.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-amber-400" />
                    Partes e Instrumentos Detectados ({analysisResult.parts.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.parts.map((part, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-300 font-medium">
                        {part.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full" disabled={isAnalyzing}>
                Continuar al Asistente Visual de Pentagramas
              </Button>
            </form>
          </Card>
        ) : (
          /* PASO 2: ASISTENTE VISUAL Y REVISIÓN DE PENTAGRAMAS */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[560px] relative overflow-hidden flex flex-col items-center justify-between gap-4">
              {/* Top Bar con Paginación */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-200">
                    Página {currentPage} de {Math.max(1, pagesData.length || pageImages.length || 1)}
                  </span>
                  {pagesData.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={currentPage >= (pagesData.length || pageImages.length || 1)}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('uploaded')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      viewMode === 'uploaded' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('digital')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      viewMode === 'digital' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Notación SVG
                  </button>
                </div>
              </div>

              {/* Score Display Area with Staves & Measure Markers */}
              <div className="w-full h-[520px] bg-slate-950 border border-slate-800 rounded-xl relative p-4 flex flex-col justify-between select-none overflow-hidden shadow-inner">
                {activePageImage && viewMode === 'uploaded' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePageImage}
                      alt={`Página ${currentPage}`}
                      className="max-w-full max-h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                ) : (
                  <MusicScoreSheet
                    title={title || 'Partitura en Edición'}
                    composer={composer || 'Compositor'}
                    timeSignature={timeSignature}
                    selectedInstrument="Todos"
                  />
                )}

                {/* Overlaid Systems & Staves */}
                {currentSystems.map((sys) => (
                  <React.Fragment key={sys.systemOrder}>
                    <HighlightOverlay
                      bboxX={sys.bboxX}
                      bboxY={sys.bboxY}
                      bboxW={sys.bboxW}
                      bboxH={sys.bboxH}
                      label={`Sistema #${sys.systemOrder} (Compás ${sys.measureStart}-${sys.measureStart + sys.measureCount - 1})`}
                    />
                    {/* Indicador discreto de compases dentro del sistema */}
                    {sys.measures && sys.measures.map((m) => (
                      <div
                        key={m.measureNumber}
                        style={{
                          left: `${m.xStart * 100}%`,
                          top: `${(sys.bboxY + sys.bboxH) * 100}%`,
                        }}
                        className="absolute -translate-y-full px-1 py-0.5 rounded bg-slate-950/80 border border-amber-500/40 text-[9px] font-mono text-amber-300 font-bold pointer-events-none z-10"
                      >
                        c.{m.measureNumber}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 text-center w-full">
                Cada renglón enmarca los pentagramas con compases discretos para garantizar la sincronización milimétrica en atril.
              </p>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Sistemas en Pág. {currentPage} ({currentSystems.length})</span>
                    <Button onClick={handleAddSystem} variant="ghost" size="sm">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Agregar
                    </Button>
                  </CardTitle>
                  <CardDescription>Ajusta el compás de inicio y la cantidad por renglón.</CardDescription>
                </CardHeader>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {currentSystems.map((sys) => {
                    const isSelected = activeSystemId === `sys-${sys.systemOrder}`
                    return (
                      <div
                        key={sys.systemOrder}
                        onClick={() => setActiveSystemId(`sys-${sys.systemOrder}`)}
                        className={`p-3 rounded-xl border text-xs space-y-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-amber-400">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-amber-400" />
                            <span>Sistema #{sys.systemOrder}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({sys.confidence >= 0.8 ? 'Alta confianza' : 'Revisión sugerida'})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveSystem(sys.systemOrder)
                            }}
                            className="text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500">Compás Inicio</label>
                            <input
                              type="number"
                              min={1}
                              value={sys.measureStart}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value))
                                handleUpdateSystem(sys.systemOrder, { measureStart: val })
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Cant. Compases</label>
                            <input
                              type="number"
                              min={1}
                              value={sys.measureCount}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value))
                                handleUpdateSystem(sys.systemOrder, { measureCount: val })
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        {/* Alineación vertical */}
                        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60">
                          <span>Alineación vertical:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateSystem(sys.systemOrder, { bboxY: Math.max(0, sys.bboxY - 0.02) })
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateSystem(sys.systemOrder, { bboxY: Math.min(0.85, sys.bboxY + 0.02) })
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {saveError && (
                  <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-400 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{saveError}</span>
                  </p>
                )}

                <div className="pt-4 border-t border-slate-800 flex gap-2">
                  <Button onClick={() => setStep('meta')} variant="outline" className="w-1/2" disabled={isSaving}>
                    Atrás
                  </Button>
                  <Button onClick={() => void handleSaveScore()} variant="primary" className="w-1/2" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Guardar Obra
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
