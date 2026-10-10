'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { Search, Plus, Play, Filter, BookOpen, Clock, ArrowLeft, AlertCircle, Loader2, LogIn, FileText } from 'lucide-react'
import { createRoomForVersion, fetchLatestVersion } from '../../../lib/rooms'

interface LibraryWork {
  id: string
  title: string
  composer: string | null
  catalog_reference: string | null
  key_signature: string | null
  time_signature: string | null
  default_tempo_bpm: number | null
  total_measures: number | null
}

export default function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const supabase = createBrowserClient()

  const [search, setSearch] = useState('')
  const [composerFilter, setComposerFilter] = useState('all')
  const [keyFilter, setKeyFilter] = useState('all')

  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [isAnon, setIsAnon] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [works, setWorks] = useState<LibraryWork[]>([])
  const [startingWorkId, setStartingWorkId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadWorks = async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (cancelled) return
      if (!authData.user) {
        setIsAnon(true)
        setLoadError(null)
        setPhase('ready')
        return
      }
      setIsAnon(false)

      const { data, error } = await supabase
        .from('works')
        .select('id, title, composer, catalog_reference, key_signature, time_signature, default_tempo_bpm, total_measures')
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        setLoadError(`No se pudo cargar tu biblioteca: ${error.message}`)
      } else {
        setWorks((data ?? []) as LibraryWork[])
        setLoadError(null)
      }
      setPhase('ready')
    }

    void loadWorks()
    return () => {
      cancelled = true
    }
  }, [supabase, reloadKey])

  const composers = useMemo(
    () => Array.from(new Set(works.map((w) => w.composer).filter((c): c is string => !!c))).sort(),
    [works]
  )
  const keys = useMemo(
    () => Array.from(new Set(works.map((w) => w.key_signature).filter((k): k is string => !!k))).sort(),
    [works]
  )

  const filteredWorks = works.filter((work) => {
    const haystack = `${work.title} ${work.composer ?? ''} ${work.catalog_reference ?? ''}`.toLowerCase()
    const matchesSearch = haystack.includes(search.toLowerCase())
    const matchesComposer = composerFilter === 'all' || work.composer === composerFilter
    const matchesKey = keyFilter === 'all' || work.key_signature === keyFilter
    return matchesSearch && matchesComposer && matchesKey
  })

  const handleStartSessionWithWork = async (work: LibraryWork) => {
    setActionError(null)
    setStartingWorkId(work.id)
    try {
      const version = await fetchLatestVersion(supabase, work.id)
      if (!version) {
        setActionError(`«${work.title}» no tiene versiones registradas. Vuelve a subirla desde /upload.`)
        return
      }
      const result = await createRoomForVersion(supabase, version.id, work.default_tempo_bpm)
      if (!result.ok) {
        if (result.kind === 'auth') {
          router.push(`/${locale}/login`)
          return
        }
        setActionError(result.message)
        return
      }
      router.push(`/${locale}/session/${result.roomCode}`)
    } catch (e: any) {
      setActionError(e?.message || 'No se pudo iniciar la sala.')
    } finally {
      setStartingWorkId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}`} className="text-slate-400 hover:text-amber-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-7 h-7 text-amber-500" />
                Biblioteca de Partituras
              </h1>
              <p className="text-sm text-slate-400">Tus obras registradas y marcadas para lectura sincronizada.</p>
            </div>
          </div>

          <Button asChild variant="primary" size="md">
            <Link href={`/${locale}/upload`}>
              <Plus className="w-4 h-4 mr-1.5" />
              Subir Nueva Partitura
            </Link>
          </Button>
        </div>

        {actionError && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span>Cargando tu biblioteca…</span>
          </div>
        )}

        {phase === 'ready' && isAnon && (
          <div className="py-20 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <LogIn className="w-7 h-7 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100">Inicia sesión para ver tu biblioteca</h2>
              <p className="text-sm text-slate-400 max-w-md">
                Tus partituras son privadas: inicia sesión para consultarlas, marcar pentagramas e iniciar salas de ensayo.
              </p>
            </div>
            <Button asChild variant="primary" size="md">
              <Link href={`/${locale}/login`}>Iniciar sesión</Link>
            </Button>
          </div>
        )}

        {phase === 'ready' && !isAnon && loadError && (
          <div className="py-20 flex flex-col items-center text-center gap-4">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-sm text-slate-400 max-w-md">{loadError}</p>
            <Button variant="outline" size="md" onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </Button>
          </div>
        )}

        {phase === 'ready' && !isAnon && !loadError && (
          <>
            {works.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-100">Tu biblioteca está vacía</h2>
                  <p className="text-sm text-slate-400 max-w-md">
                    Sube tu primera partitura en PDF o imagen y marca sus pentagramas para poder iniciar una sala sincronizada.
                  </p>
                </div>
                <Button asChild variant="primary" size="md">
                  <Link href={`/${locale}/upload`}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Subir mi primera partitura
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Filters & Search */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="sm:col-span-1 relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="Buscar por título, compositor o catálogo..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <select
                      value={composerFilter}
                      onChange={(e) => setComposerFilter(e.target.value)}
                      aria-label="Filtrar por compositor"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm appearance-none"
                    >
                      <option value="all">Todos los compositores</option>
                      {composers.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <select
                      value={keyFilter}
                      onChange={(e) => setKeyFilter(e.target.value)}
                      aria-label="Filtrar por tonalidad"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm appearance-none"
                    >
                      <option value="all">Todas las tonalidades</option>
                      {keys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Work Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWorks.map((work) => (
                    <Card key={work.id} className="flex flex-col justify-between hover:border-amber-500/40 transition-all group">
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 truncate">
                            {work.catalog_reference || work.key_signature || 'Obra'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {[work.time_signature, work.default_tempo_bpm ? `${work.default_tempo_bpm} BPM` : null]
                              .filter(Boolean)
                              .join(' • ') || '—'}
                          </span>
                        </div>
                        <CardTitle className="text-lg group-hover:text-amber-400 transition-colors">{work.title}</CardTitle>
                        <CardDescription className="text-slate-400 font-medium">{work.composer || 'Compositor desconocido'}</CardDescription>
                      </CardHeader>

                      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 font-mono">
                          {work.total_measures ? `${work.total_measures} compases` : 'Compases sin definir'}
                        </span>
                        <Button
                          onClick={() => void handleStartSessionWithWork(work)}
                          variant="primary"
                          size="sm"
                          disabled={startingWorkId === work.id}
                        >
                          {startingWorkId === work.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 mr-1" />
                          )}
                          Iniciar Sala
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {filteredWorks.length === 0 && (
                  <p className="text-center text-sm text-slate-500 py-10">
                    Ninguna obra coincide con los filtros actuales.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
