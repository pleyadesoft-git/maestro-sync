'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import {
  Check,
  Sparkles,
  ArrowLeft,
  Users,
  Music,
  ShieldCheck,
  Loader2,
  Info,
  Share2,
} from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale ?? 'es'
  const supabase = createBrowserClient()

  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubscribe = async (planBaseCode: string) => {
    setErrorMsg(null)
    setLoadingPlan(planBaseCode)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.push(`/${locale}/login?next=/${locale}/pricing`)
        return
      }

      const planCode = `${planBaseCode}_${interval === 'year' ? 'annual' : 'monthly'}`

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planCode,
          interval,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error || 'No se pudo iniciar el proceso de suscripción.')
      }

      window.location.href = json.url
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al conectar con la pasarela de pago.')
      setLoadingPlan(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-12 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation & Header */}
        <div className="text-center space-y-4">
          <Link
            href={`/${locale}/library`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Biblioteca</span>
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Precios especiales de introducción • 15 días de prueba gratuita
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Planes diseñados para cada músico y ensamble
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Sincronización milimétrica sin drift, lectura inteligente interactiva y control total desde atriles y escenarios.
          </p>

          {/* Billing Interval Toggle with -15% Discount Badge */}
          <div className="pt-4 flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  interval === 'month'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setInterval('year')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  interval === 'year'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Anual</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                  -15% Dto.
                </span>
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="max-w-md mx-auto p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 text-center">
            {errorMsg}
          </div>
        )}

        {/* 3 Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 1. Solo ($5 USD) */}
          <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 hover:border-amber-500/40 transition-all p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit">
                  <Music className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Introducción
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Solo</h3>
              <p className="text-xs text-slate-400 mt-1">Para solistas, estudiantes y músicos independientes.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$51' : '$5'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">Equivale a $4.25 USD/mes</p>
              )}

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Control de reproducción propio (solista)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Subida y biblioteca ilimitada de partituras</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Detección automática de compases, tempo y armadura</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Cambio de escala (key) y tempo dinámico</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Compartir partituras y configuración libremente</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('solo')}
              disabled={loadingPlan === 'solo'}
              className="w-full mt-6"
            >
              {loadingPlan === 'solo' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Solo'}
            </Button>
          </Card>

          {/* 2. Band ($65 USD) - Más Popular */}
          <Card className="flex flex-col justify-between border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-slate-900/90 relative p-6 sm:p-8 space-y-6 shadow-xl ring-1 ring-amber-500/30">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide uppercase">
              Más Popular
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 w-fit">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Introducción
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Band</h3>
              <p className="text-xs text-slate-400 mt-1">Para grupos, bandas y ensambles de 2 a 20 músicos.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$663' : '$65'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">Equivale a $55.25 USD/mes</p>
              )}
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                De 2 a 20 músicos incluidos sin costos extra
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>De 2 a 20 músicos por ensamble</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Director con control de la partitura y tempo en vivo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Atriles sincronizados milimétricamente en tiempo real</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Transposición dinámica y seguimiento interactivo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Compartir partituras y configuración con cualquier usuario</span>
                </li>
              </ul>
            </div>

            <Button
              variant="primary"
              onClick={() => handleSubscribe('band')}
              disabled={loadingPlan === 'band'}
              className="w-full mt-6"
            >
              {loadingPlan === 'band' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Band'}
            </Button>
          </Card>

          {/* 3. Orchestra ($95 USD) */}
          <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 hover:border-amber-500/40 transition-all p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Introducción
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Orchestra</h3>
              <p className="text-xs text-slate-400 mt-1">Para orquestas sinfónicas, filarmónicas y grandes agrupaciones.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$969' : '$95'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">Equivale a $80.75 USD/mes</p>
              )}
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                Músicos y atriles ilimitados (más de 20 músicos)
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Músicos y atriles ilimitados sin restricciones</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Full score para el director y particellas por instrumento</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Sincronización en tiempo real para orquesta completa</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Transposición de partes y modulación en vivo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Compartir partituras y configuración con cualquier usuario</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('orchestra')}
              disabled={loadingPlan === 'orchestra'}
              className="w-full mt-6"
            >
              {loadingPlan === 'orchestra' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Orchestra'}
            </Button>
          </Card>
        </div>

        {/* Nota explicativa de funcionalidades transversales */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3.5 text-xs text-slate-400">
          <Share2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">Compartir partituras y configuración en todos los planes</p>
            <p>
              Tanto en <strong>Solo</strong>, <strong>Band</strong> como en <strong>Orchestra</strong>, puedes compartir tus partituras y sus configuraciones (tonalidad/escala, tempo BPM y notas) con otros músicos registrados sin restricciones.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
