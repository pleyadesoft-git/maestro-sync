'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@music-flow/ui'
import { Music, Play, PlusCircle, LogIn, Sparkles, BookOpen, Shield } from 'lucide-react'

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) return
    router.push(`/${locale}/session/${roomCode.trim().toUpperCase()}`)
  }

  const handleCreateQuickRoom = () => {
    // Generate a random 6-character room code (e.g., "MZ7K2Q")
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    router.push(`/${locale}/session/${code}?role=director`)
  }

  return (
    <main className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-amber-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Badge */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-wider uppercase mb-8 shadow-sm shadow-amber-500/20">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Lectura Sincronizada PWA</span>
      </div>

      {/* Hero Title */}
      <div className="max-w-3xl text-center mb-12">
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-100 tracking-tight leading-tight mb-4">
          Maestro<span className="text-amber-500">Sync</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
          Lectura digital de partituras para orquestas. El Director controla el avance en tiempo real y resalta el pentagrama de cada músico en su atril.
        </p>
      </div>

      {/* Interactive Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Join Session Card */}
        <Card className="flex flex-col justify-between border-amber-500/20 hover:border-amber-500/40 transition-all">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <CardTitle>Unirme a una Sala</CardTitle>
            <CardDescription>Ingresa como Ejecutante con el código proporcionado por tu Director.</CardDescription>
          </CardHeader>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Código de sala (ej. MZ7K2Q)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase tracking-widest font-mono text-center text-lg font-bold"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Ingresar a la Sala
            </Button>
          </form>
        </Card>

        {/* Create Session Card */}
        <Card className="flex flex-col justify-between hover:border-slate-700 transition-all">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-2">
              <PlusCircle className="w-6 h-6" />
            </div>
            <CardTitle>Iniciar como Director</CardTitle>
            <CardDescription>Crea una nueva sala efímera y controla la reproducción y el tempo en tiempo real.</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <Button onClick={handleCreateQuickRoom} variant="secondary" className="w-full">
              Crear Sala Inmediata
            </Button>
            <Link href={`/${locale}/library`} className="block">
              <Button variant="outline" className="w-full">
                <BookOpen className="w-4 h-4 mr-2" />
                Elegir de mi Biblioteca
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Navigation Footer */}
      <footer className="mt-16 flex items-center gap-6 text-sm text-slate-500">
        <Link href={`/${locale}/login`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <LogIn className="w-4 h-4" />
          <span>Iniciar sesión / Registrarse</span>
        </Link>
        <span>•</span>
        <Link href={`/${locale}/library`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <Music className="w-4 h-4" />
          <span>Mi Biblioteca</span>
        </Link>
        <span>•</span>
        <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <Shield className="w-4 h-4" />
          <span>Panel Admin</span>
        </a>
      </footer>
    </main>
  )
}
