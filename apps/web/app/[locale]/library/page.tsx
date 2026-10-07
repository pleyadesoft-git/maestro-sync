'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@music-flow/ui'
import { Search, Plus, Music, Play, Filter, BookOpen, Clock, ArrowLeft } from 'lucide-react'

const MOCK_WORKS = [
  {
    id: 'work-1',
    title: 'Sinfonía No. 5 en Do Menor, Op. 67',
    composer: 'Ludwig van Beethoven',
    catalog_reference: 'Op. 67',
    key_signature: 'C minor',
    time_signature: '2/4',
    default_tempo_bpm: 108,
    total_measures: 502,
    created_at: '2026-08-10T12:00:00Z',
  },
  {
    id: 'work-2',
    title: 'Las Cuatro Estaciones — El Verano',
    composer: 'Antonio Vivaldi',
    catalog_reference: 'RV 315',
    key_signature: 'G minor',
    time_signature: '3/4',
    default_tempo_bpm: 130,
    total_measures: 240,
    created_at: '2026-08-11T15:30:00Z',
  },
  {
    id: 'work-3',
    title: 'El Lago de los Cisnes — Danza de los Cisnes',
    composer: 'Pyotr Ilyich Tchaikovsky',
    catalog_reference: 'Op. 20',
    key_signature: 'F# minor',
    time_signature: '4/4',
    default_tempo_bpm: 96,
    total_measures: 180,
    created_at: '2026-08-12T09:00:00Z',
  },
]

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [composerFilter, setComposerFilter] = useState('all')

  const filteredWorks = MOCK_WORKS.filter((work) => {
    const matchesSearch =
      work.title.toLowerCase().includes(search.toLowerCase()) ||
      work.composer.toLowerCase().includes(search.toLowerCase()) ||
      work.catalog_reference.toLowerCase().includes(search.toLowerCase())
    const matchesComposer = composerFilter === 'all' || work.composer === composerFilter
    return matchesSearch && matchesComposer
  })

  const handleStartSessionWithWork = (workId: string) => {
    const code = generateRoomCode()
    router.push(`/${locale}/session/${code}?role=director&workId=${workId}`)
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

          <Link href={`/${locale}/upload`}>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              Subir Nueva Partitura
            </Button>
          </Link>
        </div>

        {/* Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por título, compositor o catálogo (ej. Beethoven, Op. 67)..."
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
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 text-sm appearance-none"
            >
              <option value="all">Todos los compositores</option>
              <option value="Ludwig van Beethoven">Ludwig van Beethoven</option>
              <option value="Antonio Vivaldi">Antonio Vivaldi</option>
              <option value="Pyotr Ilyich Tchaikovsky">Pyotr Ilyich Tchaikovsky</option>
            </select>
          </div>
        </div>

        {/* Work Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorks.map((work) => (
            <Card key={work.id} className="flex flex-col justify-between hover:border-amber-500/40 transition-all group">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                    {work.catalog_reference}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {work.time_signature} • {work.default_tempo_bpm} BPM
                  </span>
                </div>
                <CardTitle className="text-lg group-hover:text-amber-400 transition-colors">{work.title}</CardTitle>
                <CardDescription className="text-slate-400 font-medium">{work.composer}</CardDescription>
              </CardHeader>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-mono">{work.total_measures} compases</span>
                <Button onClick={() => handleStartSessionWithWork(work.id)} variant="primary" size="sm">
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Iniciar Sala
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
