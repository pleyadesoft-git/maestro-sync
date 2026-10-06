'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, HighlightOverlay } from '@music-flow/ui'
import { Upload, ArrowLeft, Check, Plus, Trash2, Layers, Music, Sliders } from 'lucide-react'

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

  // Manual marking state
  const [systems, setSystems] = useState<SystemMark[]>([
    { id: 'sys-1', measureStart: 1, measureCount: 8, instrument: 'Violín I', bboxX: 0.05, bboxY: 0.12, bboxW: 0.9, bboxH: 0.15 },
    { id: 'sys-2', measureStart: 9, measureCount: 8, instrument: 'Violín II', bboxX: 0.05, bboxY: 0.32, bboxW: 0.9, bboxH: 0.15 },
    { id: 'sys-3', measureStart: 17, measureCount: 8, instrument: 'Viola', bboxX: 0.05, bboxY: 0.52, bboxW: 0.9, bboxH: 0.15 },
    { id: 'sys-4', measureStart: 25, measureCount: 8, instrument: 'Violonchelo', bboxX: 0.05, bboxY: 0.72, bboxW: 0.9, bboxH: 0.15 },
  ])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name)
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
              onSubmit={(e) => {
                e.preventDefault()
                setStep('mark')
              }}
              className="space-y-6"
            >
              {/* File Upload Box */}
              <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-8 text-center bg-slate-900/50 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-200">
                  {fileName ? fileName : 'Haz clic o arrastra tu partitura en PDF o Imagen'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Soporta PDF multipágina y archivos JPG/PNG</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Título de la Obra</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Sonata para Piano No. 14"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Compositor</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. W. A. Mozart"
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Referencia de Catálogo</label>
                  <input
                    type="text"
                    placeholder="ej. K. 299 / Op. 12"
                    value={catalogRef}
                    onChange={(e) => setCatalogRef(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tempo Base (BPM)</label>
                  <input
                    type="number"
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                Continuar al Editor de Pentagramas
              </Button>
            </form>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Canvas Preview Area */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[500px] relative overflow-hidden flex flex-col items-center justify-center">
              <div className="w-full h-[480px] bg-slate-950 border border-slate-800 rounded-xl relative p-4 flex flex-col justify-between select-none">
                {/* Mock Sheet Music Lines Background */}
                <div className="space-y-12 opacity-30 my-auto">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-1">
                      <div className="h-[1px] bg-slate-300" />
                      <div className="h-[1px] bg-slate-300" />
                      <div className="h-[1px] bg-slate-300" />
                      <div className="h-[1px] bg-slate-300" />
                      <div className="h-[1px] bg-slate-300" />
                    </div>
                  ))}
                </div>

                {/* Overlaid Bounding Boxes */}
                {systems.map((sys, idx) => (
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

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {systems.map((sys, index) => (
                    <div key={sys.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-amber-400">
                        <span>Renglón #{index + 1}</span>
                        <button onClick={() => handleRemoveSystem(sys.id)} className="text-slate-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">Compás Inicio</label>
                          <input
                            type="number"
                            value={sys.measureStart}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setSystems(systems.map((s) => (s.id === sys.id ? { ...s, measureStart: val } : s)))
                            }}
                            className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Cant. Compases</label>
                          <input
                            type="number"
                            value={sys.measureCount}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setSystems(systems.map((s) => (s.id === sys.id ? { ...s, measureCount: val } : s)))
                            }}
                            className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
