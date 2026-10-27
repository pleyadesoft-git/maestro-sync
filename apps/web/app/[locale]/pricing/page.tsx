'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@music-flow/ui'
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
            15 días de prueba gratuita incluidos en todas las cuentas
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            Planes diseñados para cada ensamble
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Sincronización musical milimétrica, biblioteca ilimitada y control en tiempo real desde atriles y escenarios.
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

        {/* 3 Modalities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 1. Músico Independiente */}
          <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 hover:border-amber-500/40 transition-all p-6 sm:p-8 space-y-6">
            <div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit mb-4">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Músico Independiente</h3>
              <p className="text-xs text-slate-400 mt-1">Para solistas y músicos de sesión individuales.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$81.60' : '$8'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">Equivale a $6.80 USD/mes</p>
              )}

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Subida y biblioteca de partituras ilimitadas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Detección automática de sistemas y compases</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Modo atril de alto contraste para estudio</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Exención de cargo de $3 en orquestas y bandas</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('individual')}
              disabled={loadingPlan === 'individual'}
              className="w-full mt-6"
            >
              {loadingPlan === 'individual' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Individual'}
            </Button>
          </Card>

          {/* 2. Banda con Director (Popular) */}
          <Card className="flex flex-col justify-between border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-slate-900/90 relative p-6 sm:p-8 space-y-6 shadow-xl ring-1 ring-amber-500/30">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide uppercase">
              Más Popular
            </div>

            <div>
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 w-fit mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Banda con Director</h3>
              <p className="text-xs text-slate-400 mt-1">Ideal para grupos, ensambles de cámara y bandas de hasta 15 integrantes.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$224.40' : '$22'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                + {interval === 'year' ? '$30.60' : '$3'} USD por músico sin suscripción propia
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Hasta 15 músicos por ensamble</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Control de ensayo en vivo para el director</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Asignación de atriles personalizada por músico</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Sincronización milimétrica Realtime sin drift</span>
                </li>
              </ul>
            </div>

            <Button
              variant="primary"
              onClick={() => handleSubscribe('band')}
              disabled={loadingPlan === 'band'}
              className="w-full mt-6"
            >
              {loadingPlan === 'band' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Banda'}
            </Button>
          </Card>

          {/* 3. Orquesta Sinfónica / Filarmónica */}
          <Card className="flex flex-col justify-between border-slate-800 bg-slate-900/60 hover:border-amber-500/40 transition-all p-6 sm:p-8 space-y-6">
            <div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Orquesta Sinfónica / Filarmónica</h3>
              <p className="text-xs text-slate-400 mt-1">Para orquestas completas, conservatorios y grandes ensambles sin límite.</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$459' : '$45'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                + {interval === 'year' ? '$30.60' : '$3'} USD por músico sin suscripción propia
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Músicos y atriles ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Partituras generales y particellas por instrumento</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Mapa de repeticiones y control de director en vivo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Soporte prioritario y portal de facturación central</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('orchestra')}
              disabled={loadingPlan === 'orchestra'}
              className="w-full mt-6"
            >
              {loadingPlan === 'orchestra' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elegir Plan Orquesta'}
            </Button>
          </Card>
        </div>

        {/* Nota explicativa de la exención de los $3 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3.5 text-xs text-slate-400">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">¿Cómo funciona la exención de los $3 USD por músico?</p>
            <p>
              Si los músicos convocados a tu orquesta o banda ya cuentan con su propia suscripción activa (o su período de prueba de 15 días vigente), <strong>no se cobrará ningún cargo adicional por ellos</strong>. Solo se facturan los atriles ocupados por ejecutantes sin cuenta activa.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
