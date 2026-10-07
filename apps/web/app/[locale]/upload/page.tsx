'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, HighlightOverlay, Input, MusicScoreSheet } from '@music-flow/ui'
import { Upload, ArrowLeft, Check, Plus, Trash2, Layers, Music, Sliders, AlertCircle, Eye, FileText, Sparkles } from 'lucide-react'

interface SystemMark {
  id: string
  measureStart: number
  measureCount: number
  instrument: string
  bboxX: number
  bboxY: number
  bboxW: number
  bboxH: number
}

export default function UploadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const [step, setStep] = useState<'meta' | 'mark'>('meta')
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [catalogRef, setCatalogRef] = useState('')
  const [tempo, setTempo] = useState(120)
  const [totalMeasures, setTotalMeasures] = useState(64)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [isRenderingPdf, setIsRenderingPdf] = useState(false)
  const [activeSystemId, setActiveSystemId] = useState<string>('sys-1')
  const [viewMode, setViewMode] = useState<'uploaded' | 'digital'>('uploaded')

  // Manual marking state - aligned with staves
  const [systems, setSystems] = useState<SystemMark[]>([
    { id: 'sys-1', measureStart: 1, measureCount: 8, instrument: 'Violín I', bboxX: 0.04, bboxY: 0.14, bboxW: 0.94, bboxH: 0.17 },
    { id: 'sys-2', measureStart: 9, measureCount: 8, instrument: 'Violín II', bboxX: 0.04, bboxY: 0.35, bboxW: 0.94, bboxH: 0.17 },
    { id: 'sys-3', measureStart: 17, measureCount: 8, instrument: 'Viola', bboxX: 0.04, bboxY: 0.56, bboxW: 0.94, bboxH: 0.17 },
    { id: 'sys-4', measureStart: 25, measureCount: 8, instrument: 'Violonchelo', bboxX: 0.04, bboxY: 0.77, bboxW: 0.94, bboxH: 0.17 },
  ])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFileName(selectedFile.name)
      setFileError(null)

      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile)
        setFilePreviewUrl(url)
        setViewMode('uploaded')
      } else if (selectedFile.type === 'application/pdf') {
        setIsRenderingPdf(true)
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
          const arrayBuffer = await selectedFile.arrayBuffer()
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
          const page = await pdf.getPage(1)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise
            const dataUrl = canvas.toDataURL('image/png')
            setFilePreviewUrl(dataUrl)
            setViewMode('uploaded')
          }
        } catch (err) {
          console.warn('PDF preview render fallback:', err)
          setViewMode('digital')
        } finally {
          setIsRenderingPdf(false)
        }
      }
    }
  }

  const handleAddSystem = () => {
    const lastMeasure = systems.length > 0 ? systems[systems.length - 1].measureStart + systems[systems.length - 1].measureCount : 1
    const newSystem: SystemMark = {
      id: `sys-${Date.now()}`,
      measureStart: lastMeasure,
      measureCount: 8,
      instrument: 'Todos',
      bboxX: 0.05,
      bboxY: Math.min(0.85, 0.15 * (systems.length + 1)),
      bboxW: 0.9,
      bboxH: 0.12,
    }
    setSystems([...systems, newSystem])
  }

  const handleRemoveSystem = (id: string) => {
    setSystems(systems.filter((sys) => sys.id !== id))
  }

  const handleSaveScore = () => {
    router.push(`/${locale}/library`)
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto">
        <Link href={`/${locale}/library`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Biblioteca</span>
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Subida y Marcado de Pentagramas</h1>
            <p className="text-sm text-slate-400">Paso {step === 'meta' ? '1: Metadatos y Archivo' : '2: Marcado Manual de Renglones'}</p>
          </div>
        </div>

        {step === 'meta' ? (
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle>1. Información de la Obra</CardTitle>
              <CardDescription>Carga el archivo PDF/Imagen e indica los datos base para el cálculo de highlight.</CardDescription>
            </CardHeader>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                let hasError = false

                if (!fileName) {
                  setFileError('Por favor selecciona una partitura en formato PDF o Imagen para continuar')
                  hasError = true
                }

                const form = e.currentTarget
                if (!form.checkValidity()) {
                  hasError = true
                  const firstInvalid = form.querySelector(':invalid') as HTMLElement
                  if (firstInvalid) {
                    firstInvalid.focus()
                    firstInvalid.setAttribute('aria-invalid', 'true')
                  }
                  form.querySelectorAll(':invalid').forEach((el) => el.setAttribute('aria-invalid', 'true'))
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
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${fileError ? 'text-rose-400' : 'text-amber-500'}`} />
                  <p className="text-sm font-semibold text-slate-200">
                    {fileName ? fileName : 'Haz clic o arrastra tu partitura en PDF o Imagen'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Soporta PDF multipágina y archivos JPG/PNG</p>
                </div>

                {fileError && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-rose-400 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{fileError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Título de la Obra"
                  required
                  placeholder="ej. Sonata para Piano No. 14"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <Input
                  label="Compositor"
                  required
                  placeholder="ej. W. A. Mozart"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                />

                <Input
                  label="Referencia de Catálogo"
                  placeholder="ej. K. 299 / Op. 12"
                  value={catalogRef}
                  onChange={(e) => setCatalogRef(e.target.value)}
                  helperText="Opcional: Catálogo BWV, KV, Hob. u Opus"
                />

                <Input
                  label="Tempo Base (BPM)"
                  type="number"
                  min={30}
                  max={320}
                  required
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  helperText="Rango estándar: 30 a 320 BPM"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full">
                Continuar al Editor de Pentagramas
              </Button>
            </form>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Canvas Preview Area */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[560px] relative overflow-hidden flex flex-col items-center justify-between gap-4">
              {/* Top Mode Bar */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">
                    {filePreviewUrl && viewMode === 'uploaded' ? 'Vista: Partitura Original con Notas' : 'Vista: Notación con Notas Reales'}
                  </span>
                  {isRenderingPdf && (
                    <span className="text-amber-400 animate-pulse text-[11px]">(Renderizando página PDF...)</span>
                  )}
                </div>

                {filePreviewUrl && (
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setViewMode('uploaded')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        viewMode === 'uploaded'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Archivo Subido
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('digital')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        viewMode === 'digital'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Notación SVG
                    </button>
                  </div>
                )}
              </div>

              {/* Score Display Area with Staves and Real Notes */}
              <div className="w-full h-[520px] bg-slate-950 border border-slate-800 rounded-xl relative p-4 flex flex-col justify-between select-none overflow-hidden shadow-inner">
                {filePreviewUrl && viewMode === 'uploaded' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={filePreviewUrl}
                      alt="Partitura cargada"
                      className="max-w-full max-h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                ) : (
                  <MusicScoreSheet
                    title={title || 'Partitura en Edición'}
                    composer={composer || 'Compositor'}
                    timeSignature="2/4"
                    selectedInstrument="Todos"
                  />
                )}

                {/* Overlaid Bounding Boxes for Each Stave */}
                {systems.map((sys) => (
                  <HighlightOverlay
                    key={sys.id}
                    bboxX={sys.bboxX}
                    bboxY={sys.bboxY}
                    bboxW={sys.bboxW}
                    bboxH={sys.bboxH}
                    label={`${sys.instrument} (Compás ${sys.measureStart}-${sys.measureStart + sys.measureCount - 1})`}
                  />
                ))}
              </div>

              <p className="text-[11px] text-slate-500 text-center w-full">
                Cada renglón enmarca el pentagrama con sus notas correspondientes para la sincronización milimétrica.
              </p>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Pentagramas ({systems.length})</span>
                    <Button onClick={handleAddSystem} variant="ghost" size="sm">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Agregar
                    </Button>
                  </CardTitle>
                  <CardDescription>Define compases por renglón para sincronización fluida.</CardDescription>
                </CardHeader>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {systems.map((sys, index) => {
                    const isSelected = activeSystemId === sys.id
                    return (
                      <div
                        key={sys.id}
                        onClick={() => setActiveSystemId(sys.id)}
                        className={`p-3 rounded-xl border text-xs space-y-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-amber-400">
                          <span className="flex items-center gap-1.5">
                            <span>Renglón #{index + 1}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({sys.instrument})</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveSystem(sys.id)
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
                              required
                              value={sys.measureStart}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value))
                                setSystems(systems.map((s) => (s.id === sys.id ? { ...s, measureStart: val } : s)))
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Cant. Compases</label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={sys.measureCount}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value))
                                setSystems(systems.map((s) => (s.id === sys.id ? { ...s, measureCount: val } : s)))
                              }}
                              className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40"
                            />
                          </div>
                        </div>

                        {/* Fine tuning vertical positioning */}
                        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60">
                          <span>Alineación vertical:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSystems(systems.map((s) => (s.id === sys.id ? { ...s, bboxY: Math.max(0, s.bboxY - 0.02) } : s)))
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSystems(systems.map((s) => (s.id === sys.id ? { ...s, bboxY: Math.min(0.85, s.bboxY + 0.02) } : s)))
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

                <div className="pt-4 border-t border-slate-800 flex gap-2">
                  <Button onClick={() => setStep('meta')} variant="outline" className="w-1/2">
                    Atrás
                  </Button>
                  <Button onClick={handleSaveScore} variant="primary" className="w-1/2">
                    <Check className="w-4 h-4 mr-1" />
                    Guardar
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
