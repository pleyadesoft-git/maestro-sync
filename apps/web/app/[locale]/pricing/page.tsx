'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { CopyrightNotice } from '../../components/CopyrightNotice'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import {
  Check,
  Sparkles,
  ArrowLeft,
  Users,
  Music,
  ShieldCheck,
  Loader2,
  Share2,
  Gift,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react'
import SubscriptionModal from '../../components/SubscriptionModal'

export default function PricingPage() {
  const router = useRouter()
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale ?? 'es'
  const t = useTranslations('pricing')
  const tCommon = useTranslations('common')
  const tSub = useTranslations('subscription')
  const supabase = createBrowserClient()

  const [currentSub, setCurrentSub] = useState<any>(null)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [courtesyCode, setCourtesyCode] = useState('')
  const [redeemingCourtesy, setRedeemingCourtesy] = useState(false)
  const [courtesyError, setCourtesyError] = useState<string | null>(null)
  const [courtesySuccess, setCourtesySuccess] = useState<string | null>(null)

  const loadUserSub = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok && json.ok && json.hasSubscription) {
        setCurrentSub(json.subscription)
      } else {
        setCurrentSub(null)
      }
    } catch {
      // Ignorar errores no críticos
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token || cancelled) return

        const res = await fetch('/api/subscription/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!cancelled && res.ok && json.ok && json.hasSubscription) {
          setCurrentSub(json.subscription)
        }
      } catch {
        // Ignorar
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleReactivateSub = async () => {
    setReactivating(true)
    setErrorMsg(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || tSub('errorGeneric'))
      }

      await loadUserSub()
    } catch (e: any) {
      setErrorMsg(e?.message || tSub('errorGeneric'))
    } finally {
      setReactivating(false)
    }
  }

  const handleSubscribe = async (planBaseCode: string) => {
    setErrorMsg(null)
    setLoadingPlan(planBaseCode)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.push(`/${locale}/login?mode=register&next=/${locale}/pricing`)
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
        throw new Error(json.error || t('checkoutError'))
      }

      window.location.href = json.url
    } catch (err: any) {
      setErrorMsg(err?.message || t('gatewayError'))
      setLoadingPlan(null)
    }
  }

  const handleRedeemCourtesy = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = courtesyCode.trim().toUpperCase()
    if (!trimmed) {
      setCourtesyError(t('courtesyInvalid'))
      return
    }

    setRedeemingCourtesy(true)
    setCourtesyError(null)
    setCourtesySuccess(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.push(`/${locale}/login?mode=register&next=/${locale}/pricing`)
        return
      }

      const res = await fetch('/api/courtesy/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        setCourtesyError(json.error || t('courtesyRedeemError'))
        return
      }

      setCourtesySuccess(
        t('courtesySuccess', { code: json.code, planName: json.planName })
      )
      setCourtesyCode('')
      setTimeout(() => {
        router.push(`/${locale}/library`)
      }, 2000)
    } catch (err: any) {
      setCourtesyError(err?.message || t('courtesyRedeemError'))
    } finally {
      setRedeemingCourtesy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-12 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation & Header */}
        <div className="text-center space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto mb-2">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('backHome')}</span>
            </Link>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192x192.png"
                  alt={tCommon('logoAlt')}
                  className="w-8 h-8 rounded-lg border border-amber-500/30"
                />
                <span className="font-extrabold text-slate-100 text-base">
                  Maestro<span className="text-amber-500">Sync</span>
                </span>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {t('promoBadge')}
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
            {t('title')}
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            {t('subtitle')}
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
                {t('monthly')}
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
                <span>{t('annual')}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                  {t('discountBadge')}
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

        {/* Banner de Suscripción Actual si el usuario tiene una activa */}
        {currentSub && currentSub.isActive && (
          <Card className="p-6 bg-slate-900 border-amber-500/40 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {tSub('currentPlan')}:
                    </span>
                    <h2 className="text-lg font-bold text-slate-100">{currentSub.planName}</h2>
                    {currentSub.cancelAtPeriodEnd ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {tSub('statusScheduledCancel')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tSub('statusActive')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {currentSub.cancelAtPeriodEnd
                      ? tSub('scheduledCancelAlert', {
                          date: currentSub.currentPeriodEnd
                            ? new Date(currentSub.currentPeriodEnd).toLocaleDateString(
                                locale === 'en' ? 'en-US' : 'es-ES',
                                { day: '2-digit', month: 'long', year: 'numeric' }
                              )
                            : '',
                        })
                      : `${tSub('renewalDate')}: ${
                          currentSub.currentPeriodEnd
                            ? new Date(currentSub.currentPeriodEnd).toLocaleDateString(
                                locale === 'en' ? 'en-US' : 'es-ES',
                                { day: '2-digit', month: 'long', year: 'numeric' }
                              )
                            : '—'
                        }`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {currentSub.cancelAtPeriodEnd ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleReactivateSub}
                    disabled={reactivating}
                    className="font-semibold text-xs"
                  >
                    {reactivating ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    <span>{reactivating ? tSub('reactivating') : tSub('reactivate')}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSubModalOpen(true)}
                    className="font-semibold text-xs border-slate-700 hover:border-amber-500/40"
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    <span>{tSub('manageTitle')}</span>
                  </Button>
                )}
              </div>
            </div>
          </Card>
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
                  {t('introBadge')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Solo</h3>
              <p className="text-xs text-slate-400 mt-1">{t('soloDesc')}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$51' : '$5'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? t('perYear') : t('perMonth')}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">{t('soloAnnualEquiv')}</p>
              )}

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('soloF1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('soloF2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('soloF3')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('soloF4')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('soloF5')}</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('soloF6')}</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('solo')}
              disabled={loadingPlan === 'solo'}
              className="w-full mt-6"
            >
              {loadingPlan === 'solo' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('chooseSolo')}
            </Button>
          </Card>

          {/* 2. Band ($65 USD) - Más Popular */}
          <Card className="flex flex-col justify-between border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-slate-900/90 relative p-6 sm:p-8 space-y-6 shadow-xl ring-1 ring-amber-500/30">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide uppercase">
              {t('mostPopular')}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 w-fit">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {t('introBadge')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Band</h3>
              <p className="text-xs text-slate-400 mt-1">{t('bandDesc')}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$663' : '$65'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? t('perYear') : t('perMonth')}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">{t('bandAnnualEquiv')}</p>
              )}
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                {t('bandHighlight')}
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('bandF1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('bandF2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('bandF3')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('bandF4')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('bandF5')}</span>
                </li>
              </ul>
            </div>

            <Button
              variant="primary"
              onClick={() => handleSubscribe('band')}
              disabled={loadingPlan === 'band'}
              className="w-full mt-6"
            >
              {loadingPlan === 'band' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('chooseBand')}
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
                  {t('introBadge')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Orchestra</h3>
              <p className="text-xs text-slate-400 mt-1">{t('orchestraDesc')}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  {interval === 'year' ? '$969' : '$95'}
                </span>
                <span className="text-xs text-slate-400">USD / {interval === 'year' ? t('perYear') : t('perMonth')}</span>
              </div>
              {interval === 'year' && (
                <p className="text-[11px] text-emerald-400 mt-1 font-medium">{t('orchestraAnnualEquiv')}</p>
              )}
              <p className="text-[11px] text-amber-400 mt-1 font-medium">
                {t('orchestraHighlight')}
              </p>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-semibold text-slate-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('orchestraF1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('orchestraF2')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('orchestraF3')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('orchestraF4')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('orchestraF5')}</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => handleSubscribe('orchestra')}
              disabled={loadingPlan === 'orchestra'}
              className="w-full mt-6"
            >
              {loadingPlan === 'orchestra' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('chooseOrchestra')}
            </Button>
          </Card>
        </div>

        {/* Sección de Canje de Código de Cortesía de 7 Días */}
        <Card className="border-amber-500/30 bg-slate-900/80 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Gift className="w-4 h-4" />
                <span>{t('courtesyBadge')}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100">
                {t('courtesyTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {t('courtesyDesc')}
              </p>
            </div>

            <form
              noValidate
              onSubmit={handleRedeemCourtesy}
              className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 w-full md:w-auto md:min-w-[380px]"
            >
              <div className="flex-1">
                <Input
                  type="text"
                  required
                  placeholder={t('courtesyPlaceholder')}
                  value={courtesyCode}
                  errorMessage={courtesyError || undefined}
                  onChange={(e) => {
                    setCourtesyCode(e.target.value.toUpperCase())
                    if (courtesyError) setCourtesyError(null)
                  }}
                  className="uppercase font-mono tracking-wider text-sm"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={redeemingCourtesy}
                className="h-11 shrink-0 font-semibold"
              >
                {redeemingCourtesy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('courtesyActivating')}
                  </>
                ) : (
                  t('courtesyButton')
                )}
              </Button>
            </form>
          </div>

          {courtesySuccess && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-3 text-xs sm:text-sm text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{courtesySuccess}</span>
            </div>
          )}
        </Card>

        {/* Nota explicativa de funcionalidades transversales */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3.5 text-xs text-slate-400">
          <Share2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">{t('sharingTitle')}</p>
            <p>{t('sharingDesc')}</p>
          </div>
        </div>

        {/* Descuento proporcional para usuarios Solo */}
        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 flex items-start gap-3.5 text-xs text-slate-300">
          <Users className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-emerald-300">{t('proportionalTitle')}</p>
            <p>{t('proportionalDesc')}</p>
          </div>
        </div>

        <CopyrightNotice locale={locale} />

        <SubscriptionModal
          isOpen={subModalOpen}
          onClose={() => {
            setSubModalOpen(false)
            void loadUserSub()
          }}
          locale={locale}
          onSubscriptionChange={() => void loadUserSub()}
        />
      </div>
    </main>
  )
}
