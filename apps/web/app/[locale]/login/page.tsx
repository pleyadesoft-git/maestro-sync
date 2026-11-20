'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, CardHeader, CardTitle, CardDescription, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { useAuthStore } from '@music-flow/stores'
import {
  Fingerprint,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  ShieldCheck,
  Check,
  Gift,
  Users,
  Music,
  Clock,
  Loader2,
} from 'lucide-react'
import {
  performWebAuthnRegister,
  performWebAuthnLogin,
  isWebAuthnSupported,
} from '../../../lib/webauthn-client'
import { CopyrightNotice } from '../../components/CopyrightNotice'
import LanguageSwitcher from '../../components/LanguageSwitcher'

type AuthMode = 'login' | 'register' | 'confirm_pending'
type SelectedTier = 'free' | 'solo' | 'band' | 'orchestra'

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const tCommon = useTranslations('common')
  const t = useTranslations('loginPage')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()

  const friendlyAuthError = (message: string): string => {
    const m = (message || '').toLowerCase()
    if (m.includes('invalid login credentials')) return t('errInvalidCredentials')
    if (m.includes('email not confirmed')) return t('errEmailNotConfirmed')
    if (
      m.includes('already registered') ||
      m.includes('already been registered') ||
      m.includes('user already exists')
    ) {
      return t('errAlreadyRegistered')
    }
    if (m.includes('password should be at least') || m.includes('password is too short')) {
      return t('errPasswordShort')
    }
    if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
      return t('errRateLimit')
    }
    if (m.includes('failed to fetch') || m.includes('networkerror')) {
      return t('errNetwork')
    }
    if (m.includes('placeholder')) return t('errSupabaseConfig')
    return message || t('errUnexpected')
  }

  const modeParam = searchParams.get('mode')
  const nextParam = searchParams.get('next')
  const reasonParam = searchParams.get('reason')
  const errorParam = searchParams.get('error')
  const confirmedParam = searchParams.get('confirmed')

  const safeNextUrl =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : `/${locale}/library`

  const [mode, setMode] = useState<AuthMode>(modeParam === 'register' ? 'register' : 'login')
  const [registerMethod, setRegisterMethod] = useState<'passkey' | 'password'>('passkey')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Estado de selección de Tier y Código de Cortesía durante el registro
  const [selectedTier, setSelectedTier] = useState<SelectedTier>('free')
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
  const [courtesyCode, setCourtesyCode] = useState('')
  const [courtesyChecking, setCourtesyChecking] = useState(false)
  const [validatedCourtesy, setValidatedCourtesy] = useState<{
    code: string
    planCode: string
    planName: string
    durationDays: number
  } | null>(null)
  const [courtesyError, setCourtesyError] = useState<string | null>(null)

  const initialError =
    errorParam === 'token_expired'
      ? t('errTokenExpired')
      : null
  const initialInfo =
    confirmedParam === 'true'
      ? t('infoConfirmed')
      : reasonParam === 'auth_required'
        ? t('infoAuthRequired')
        : null

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError)
  const [infoMessage, setInfoMessage] = useState<string | null>(initialInfo)
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null)

  // Temporizador para reenvío de correo de confirmación
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Validar código de cortesía contra el backend
  const handleValidateCourtesyCode = async () => {
    const trimmed = courtesyCode.trim().toUpperCase()
    if (!trimmed) {
      setCourtesyError(t('courtesyRequired'))
      setValidatedCourtesy(null)
      return false
    }

    setCourtesyChecking(true)
    setCourtesyError(null)
    try {
      const res = await fetch('/api/courtesy/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setValidatedCourtesy(null)
        setCourtesyError(json.error || t('courtesyInvalid'))
        return false
      }
      setValidatedCourtesy({
        code: json.code,
        planCode: json.planCode,
        planName: json.planName,
        durationDays: json.durationDays,
      })
      if (json.planCode.startsWith('orchestra')) setSelectedTier('orchestra')
      else if (json.planCode.startsWith('band')) setSelectedTier('band')
      else setSelectedTier('solo')
      return true
    } catch (err: any) {
      setCourtesyError(err?.message || t('courtesyCheckError'))
      return false
    } finally {
      setCourtesyChecking(false)
    }
  }

  // Canjear código de cortesía usando el token de sesión autenticado
  const redeemCourtesyForUser = async (token: string | null, overrideCode?: string) => {
    const codeToRedeem = (overrideCode || validatedCourtesy?.code || courtesyCode).trim().toUpperCase()
    if (!codeToRedeem) return { ok: true, redeemed: false }
    if (!token) {
      try {
        window.localStorage.setItem('maestrosync_pending_courtesy_code', codeToRedeem)
      } catch {
        /* ignore storage error */
      }
      return { ok: true, redeemed: false }
    }

    const res = await fetch('/api/courtesy/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: codeToRedeem,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return { ok: false, redeemed: false, error: json.error || t('courtesyRedeemError') }
    }
    try {
      window.localStorage.removeItem('maestrosync_pending_courtesy_code')
    } catch {
      /* ignore storage error */
    }
    return { ok: true, redeemed: true, planName: json.planName }
  }

  const finishLogin = async (
    userId: string,
    userEmail: string,
    options?: { isNewRegistration?: boolean }
  ) => {
    const supabase = createBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? null

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!profile && token) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (json.ok && json.profile) {
          profile = json.profile
        }
      } catch {
        /* fallback silencioso */
      }
    }

    setAuth({ id: userId, email: userEmail }, profile)

    // Si existía un código de cortesía pendiente guardado antes de confirmar correo, canjearlo ahora con sesión válida
    let pendingCourtesy: string | null = null
    try {
      pendingCourtesy = window.localStorage.getItem('maestrosync_pending_courtesy_code')
    } catch {
      pendingCourtesy = null
    }
    if (pendingCourtesy && token && !options?.isNewRegistration) {
      await redeemCourtesyForUser(token, pendingCourtesy)
    }

    if (options?.isNewRegistration) {
      // 1) Si ingresó un código de cortesía, canjearlo de inmediato con token válido
      if (courtesyCode.trim()) {
        const redeemRes = await redeemCourtesyForUser(token)
        if (!redeemRes.ok) {
          setErrorMessage(redeemRes.error || t('courtesyActivateError'))
        }
        router.push(safeNextUrl)
        return
      }

      // 2) Si eligió un tier de pago (Solo, Band u Orchestra) sin código de cortesía, iniciar Checkout o ir a /pricing
      if (selectedTier !== 'free' && token) {
        try {
          const planCode = `${selectedTier}_${billingInterval === 'year' ? 'annual' : 'monthly'}`
          const checkoutRes = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              planCode,
              interval: billingInterval,
            }),
          })
          const checkoutJson = await checkoutRes.json()
          if (checkoutRes.ok && checkoutJson.ok && checkoutJson.url) {
            window.location.href = checkoutJson.url
            return
          }
        } catch {
          // Si Stripe no está configurado en local, redirigir a /pricing
        }
        router.push(`/${locale}/pricing`)
        return
      }
    }

    router.push(safeNextUrl)
  }

  // --- WebAuthn / Passkeys: Login ---
  const handlePasskeyLogin = async () => {
    setErrorMessage(null)
    setInfoMessage(null)
    setPasskeyStatus(t('passkeyStarting'))
    setLoading(true)

    if (!isWebAuthnSupported()) {
      setLoading(false)
      setPasskeyStatus(null)
      setErrorMessage(t('passkeyUnsupported'))
      return
    }

    try {
      const result = await performWebAuthnLogin({
        email: email.trim() || undefined,
      })

      if (result.cancelled) {
        setPasskeyStatus(null)
        setLoading(false)
        return
      }

      if (!result.ok || !result.user) {
        setPasskeyStatus(null)
        setLoading(false)
        setErrorMessage(
          result.error || t('passkeyNotFound')
        )
        return
      }

      setPasskeyStatus(t('passkeyGranted'))
      await finishLogin(result.user.id, result.user.email || email)
    } catch (err: any) {
      setPasskeyStatus(null)
      setLoading(false)
      setErrorMessage(friendlyAuthError(err?.message || t('passkeyWebAuthnError')))
    }
  }

  // --- WebAuthn / Passkeys: Registro ---
  const handlePasskeyRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage(t('passkeyEmailRequired'))
      return
    }

    if (!isWebAuthnSupported()) {
      setErrorMessage(t('passkeyUnsupported'))
      return
    }

    // Si escribió un código de cortesía y aún no lo ha validado, validarlo antes de crear la cuenta
    if (courtesyCode.trim() && !validatedCourtesy) {
      const valid = await handleValidateCourtesyCode()
      if (!valid) return
    }

    setLoading(true)
    setPasskeyStatus(t('passkeyConfiguring'))

    try {
      const result = await performWebAuthnRegister({
        email: trimmedEmail,
        fullName: fullName.trim() || undefined,
      })

      if (result.cancelled) {
        setPasskeyStatus(null)
        setLoading(false)
        return
      }

      if (!result.ok || !result.user) {
        setPasskeyStatus(null)
        setLoading(false)
        setErrorMessage(result.error || t('passkeyRegisterFailed'))
        return
      }

      setPasskeyStatus(t('passkeyCreated'))
      await finishLogin(result.user.id, result.user.email || trimmedEmail, {
        isNewRegistration: true,
      })
    } catch (err: any) {
      setPasskeyStatus(null)
      setLoading(false)
      setErrorMessage(friendlyAuthError(err?.message || t('passkeyRegisterError')))
    }
  }

  // --- Google OAuth ---
  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const supabase = createBrowserClient()
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(safeNextUrl)}`
          : undefined

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        setErrorMessage(friendlyAuthError(error.message))
        setLoading(false)
      }
    } catch (err: any) {
      setErrorMessage(friendlyAuthError(err?.message || t('googleConnectError')))
      setLoading(false)
    }
  }

  // --- Email + Password Auth ---
  const handleEmailAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const form = e.currentTarget
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid') as HTMLElement
      if (firstInvalid) {
        firstInvalid.focus()
        firstInvalid.setAttribute('aria-invalid', 'true')
      }
      return
    }

    if (mode === 'register' && courtesyCode.trim() && !validatedCourtesy) {
      const valid = await handleValidateCourtesyCode()
      if (!valid) return
    }

    setLoading(true)
    setErrorMessage(null)
    setInfoMessage(null)
    const supabase = createBrowserClient()

    try {
      if (mode === 'register') {
        const postConfirmNext =
          selectedTier !== 'free' && !courtesyCode.trim()
            ? `/${locale}/pricing`
            : safeNextUrl
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(postConfirmNext)}`
            : undefined

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              selected_tier: selectedTier,
            },
          },
        })

        if (error) {
          setErrorMessage(friendlyAuthError(error.message))
          return
        }

        // Si el usuario ya estaba registrado en Supabase, identities viene vacío
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setErrorMessage(t('errAlreadyRegisteredPasskey'))
          setMode('login')
          return
        }

        // Si se inició sesión inmediatamente (auto-confirm activo en Supabase)
        if (data.session && data.user) {
          await finishLogin(data.user.id, data.user.email ?? email, {
            isNewRegistration: true,
          })
          return
        }

        // Si la cuenta quedó creada pendiente de confirmación por correo y tenía código de cortesía, guardarlo para canjear al iniciar sesión
        if (data.user && courtesyCode.trim()) {
          await redeemCourtesyForUser(null)
        }

        // Cuenta creada y esperando confirmación por correo
        setResendCooldown(60)
        setMode('confirm_pending')
        return
      }

      // Inicio de sesión tradicional
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setErrorMessage(friendlyAuthError(error.message))
        return
      }

      if (data.user) {
        await finishLogin(data.user.id, data.user.email ?? email)
      }
    } catch (err: any) {
      setErrorMessage(friendlyAuthError(err?.message ?? ''))
    } finally {
      setLoading(false)
    }
  }

  // --- Reenvío de Correo de Confirmación ---
  const handleResendConfirmation = async () => {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          locale,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErrorMessage(
          friendlyAuthError(json.error || t('resendError'))
        )
      } else if (json.alreadyConfirmed) {
        setInfoMessage(t('alreadyConfirmed'))
        setMode('login')
      } else {
        setInfoMessage(t('resendSuccess'))
        setResendCooldown(60)
      }
    } catch (err: any) {
      setErrorMessage(friendlyAuthError(err?.message || t('resendNetworkError')))
    } finally {
      setResendLoading(false)
    }
  }

  const tiersList: Array<{
    id: SelectedTier
    name: string
    price: string
    period: string
    subtitle: string
    badge?: string
    popular?: boolean
    icon: React.ReactNode
    features: string[]
  }> = [
    {
      id: 'free',
      name: t('tierFreeName'),
      price: '$0',
      period: t('tierFreePeriod'),
      subtitle: t('tierFreeSub'),
      badge: t('tierFreeBadge'),
      icon: <Clock className="w-4 h-4 text-sky-400" />,
      features: [
        t('tierFreeF1'),
        t('tierFreeF2'),
      ],
    },
    {
      id: 'solo',
      name: 'Solo',
      price: billingInterval === 'year' ? '$51' : '$5',
      period: billingInterval === 'year' ? t('usdYear') : t('usdMonth'),
      subtitle: t('tierSoloSub'),
      badge: t('tierSoloBadge'),
      icon: <Music className="w-4 h-4 text-amber-400" />,
      features: [
        t('tierSoloF1'),
        t('tierSoloF2'),
        t('tierSoloF3'),
        t('tierSoloF4'),
      ],
    },
    {
      id: 'band',
      name: 'Band',
      price: billingInterval === 'year' ? '$663' : '$65',
      period: billingInterval === 'year' ? t('usdYear') : t('usdMonth'),
      subtitle: t('tierBandSub'),
      badge: t('tierBandBadge'),
      popular: true,
      icon: <Users className="w-4 h-4 text-amber-400" />,
      features: [
        t('tierBandF1'),
        t('tierBandF2'),
        t('tierBandF3'),
      ],
    },
    {
      id: 'orchestra',
      name: 'Orchestra',
      price: billingInterval === 'year' ? '$969' : '$95',
      period: billingInterval === 'year' ? t('usdYear') : t('usdMonth'),
      subtitle: t('tierOrchSub'),
      badge: t('tierOrchBadge'),
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />,
      features: [
        t('tierOrchF1'),
        t('tierOrchF2'),
        t('tierOrchF3'),
      ],
    },
  ]

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 py-12 relative">
      <Link
        href={`/${locale}`}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t('backHome')}</span>
      </Link>

      <div className="absolute top-5 right-6">
        <LanguageSwitcher />
      </div>

      <div
        className={`w-full transition-all duration-200 ${
          mode === 'register' ? 'max-w-5xl' : 'max-w-md'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt={tCommon('logoAlt')}
            className="w-11 h-11 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-950/30"
          />
          <span className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Maestro<span className="text-amber-500">Sync</span>
          </span>
        </div>

        {/* ================= VISTA: CONFIRMACIÓN PENDIENTE ================= */}
        {mode === 'confirm_pending' ? (
          <Card className="border-amber-500/20 shadow-2xl shadow-amber-950/20">
            <div className="py-2 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Mail className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-100">{t('confirmTitle')}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {t('confirmSubtitle')}
                </p>
                <p className="text-base font-semibold text-amber-400 mt-1">{email}</p>
              </div>

              {validatedCourtesy && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2 text-left">
                  <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {t('confirmCourtesyMsg', { code: validatedCourtesy.code, planName: validatedCourtesy.planName })}
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-400">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{t('confirmInstructionsTitle')}</span>
                </div>
                <p>{t('confirmStep1')}</p>
                <p>
                  {t('confirmStep2Prefix')}{' '}
                  <strong>{t('confirmStep2Bold')}</strong>.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300 text-left"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300 text-left"
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendConfirmation}
                  disabled={resendCooldown > 0 || resendLoading}
                  className="w-full h-11 text-sm border-slate-700 hover:border-amber-500/50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0
                    ? t('resendIn', { seconds: resendCooldown })
                    : t('resendButton')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode('login')
                    setErrorMessage(null)
                    setInfoMessage(null)
                  }}
                  className="w-full h-11 text-sm"
                >
                  <span>{t('backToLogin')}</span>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          /* ================= VISTA: LOGIN O REGISTRO CON TIERS ================= */
          <div
            className={
              mode === 'register'
                ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
                : 'block'
            }
          >
            {/* COLUMNA DE TIERS Y CORTESÍA (Visible en Modo Registro) */}
            {mode === 'register' && (
              <Card className="lg:col-span-7 border-amber-500/20 bg-slate-900/90 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('step1Badge')}
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-0.5">
                      {t('plansTitle')}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {t('plansSubtitle')}
                    </p>
                  </div>

                  {/* Selector Mensual / Anual */}
                  <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1 self-start">
                    <button
                      type="button"
                      onClick={() => setBillingInterval('month')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        billingInterval === 'month'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t('monthly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingInterval('year')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                        billingInterval === 'year'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{t('annual')}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                        -15%
                      </span>
                    </button>
                  </div>
                </div>

                {/* Grid de Tiers (Radio Cards accesibles) */}
                <fieldset className="space-y-3">
                  <legend className="sr-only">{t('selectPlanLegend')}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {tiersList.map((tier) => {
                      const isSelected = selectedTier === tier.id
                      return (
                        <label
                          key={tier.id}
                          className={`relative cursor-pointer rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40 shadow-lg shadow-amber-950/30'
                              : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                          }`}
                        >
                          {tier.popular && (
                            <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                              {t('mostPopular')}
                            </span>
                          )}

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="register_tier"
                                  value={tier.id}
                                  checked={isSelected}
                                  onChange={() => setSelectedTier(tier.id)}
                                  className="accent-amber-500 w-4 h-4"
                                />
                                <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                                  {tier.icon}
                                  {tier.name}
                                </span>
                              </div>
                              {tier.badge && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                  {tier.badge}
                                </span>
                              )}
                            </div>

                            <div className="flex items-baseline gap-1 mt-1 pl-6">
                              <span className="text-2xl font-extrabold text-slate-100">
                                {validatedCourtesy && isSelected && tier.id !== 'free'
                                  ? '$0'
                                  : tier.price}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {validatedCourtesy && isSelected && tier.id !== 'free'
                                  ? t('courtesyPeriod')
                                  : tier.period}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1 pl-6 leading-snug">
                              {tier.subtitle}
                            </p>

                            <ul className="mt-3 space-y-1.5 pl-6 text-[11px] text-slate-300">
                              {tier.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-2.5 text-xs text-slate-300">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-emerald-300">{t('proportionalLead')}</strong> {t('proportionalBody')}
                  </p>
                </div>

                {/* Sección de Código de Cortesía de 7 Días */}
                <div className="rounded-2xl border border-amber-500/30 bg-slate-950/90 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Gift className="w-4 h-4 shrink-0" />
                      <span>{t('haveCourtesy')}</span>
                    </div>
                    {validatedCourtesy && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('codeApplied')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder={t('courtesyPlaceholder')}
                        value={courtesyCode}
                        errorMessage={courtesyError || undefined}
                        onChange={(e) => {
                          setCourtesyCode(e.target.value.toUpperCase())
                          setCourtesyError(null)
                          if (validatedCourtesy) setValidatedCourtesy(null)
                        }}
                        className="uppercase font-mono tracking-wider text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleValidateCourtesyCode()}
                      disabled={courtesyChecking || !courtesyCode.trim()}
                      className="h-11 shrink-0 text-xs font-semibold border-amber-500/40 hover:border-amber-400"
                    >
                      {courtesyChecking ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          {t('checkingCode')}
                        </>
                      ) : (
                        t('applyCode')
                      )}
                    </Button>
                  </div>

                  {validatedCourtesy && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        {t('validCourtesyMsg', {
                          code: validatedCourtesy.code,
                          planName: validatedCourtesy.planName,
                          days: validatedCourtesy.durationDays,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* COLUMNA DE FORMULARIO DE AUTENTICACIÓN */}
            <Card
              className={`border-amber-500/20 shadow-2xl shadow-amber-950/20 ${
                mode === 'register' ? 'lg:col-span-5' : 'w-full'
              }`}
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl">
                  {mode === 'login' ? t('loginTitle') : t('registerTitle')}
                </CardTitle>
                <CardDescription>
                  {mode === 'login' ? t('loginDesc') : t('registerDesc')}
                </CardDescription>
              </CardHeader>

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200"
                >
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* SECCIÓN WEBAUTHN / GOOGLE / BIOMETRÍA */}
              {mode === 'login' ? (
                <div className="mb-6 space-y-3">
                  <Button
                    type="button"
                    onClick={handleGoogleLogin}
                    variant="secondary"
                    className="w-full h-12 border-slate-700 hover:border-amber-400 hover:bg-slate-900 transition-all flex items-center justify-center gap-2.5 font-semibold text-slate-100"
                    disabled={loading}
                  >
                    <GoogleIcon className="w-5 h-5 shrink-0" />
                    <span>{t('continueWithGoogle')}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handlePasskeyLogin}
                    variant="secondary"
                    className="w-full h-12 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2.5 group"
                    disabled={loading}
                  >
                    <Fingerprint className="w-5 h-5 text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-slate-100">
                      {t('quickPasskey')}
                    </span>
                  </Button>
                  {passkeyStatus && (
                    <p className="text-xs text-amber-400/90 text-center mt-2 font-medium animate-pulse">
                      {passkeyStatus}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 text-center">
                    {t('passkeyHint')}
                  </p>
                </div>
              ) : (
                /* En modo registro: Selector de método de registro (Passkey vs Contraseña) */
                <div className="mb-5 space-y-3">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterMethod('passkey')
                        setErrorMessage(null)
                      }}
                      className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 leading-tight ${
                        registerMethod === 'passkey'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Fingerprint className="w-4 h-4 shrink-0" />
                      <span className="flex flex-col items-center leading-tight">
                        <span className="whitespace-nowrap">{t('withPasskey')}</span>
                        <span className="text-[10px] font-semibold opacity-85 whitespace-nowrap">
                          {t('recommended')}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterMethod('password')
                        setErrorMessage(null)
                      }}
                      className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 leading-tight ${
                        registerMethod === 'password'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{t('withPassword')}</span>
                    </button>
                  </div>

                  {registerMethod === 'passkey' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {t('passkeyRegisterHint')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {mode === 'login' && (
                <div className="relative flex items-center justify-center mb-6">
                  <div className="border-t border-slate-800 w-full" />
                  <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider absolute">
                    {t('orEmailPassword')}
                  </span>
                </div>
              )}

              {mode === 'register' && (
                <div className="mb-5 space-y-1.5">
                  <CopyrightNotice locale={locale} />
                  <p className="text-[11px] text-slate-500">
                    {t('copyrightAcceptNote')}
                  </p>
                </div>
              )}

              {/* FORMULARIOS */}
              {mode === 'register' && registerMethod === 'passkey' ? (
                /* Formulario Registro con Passkey */
                <form noValidate onSubmit={handlePasskeyRegister} className="space-y-4">
                  <Input
                    label={t('nameOptionalLabel')}
                    type="text"
                    placeholder={t('namePlaceholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                  />

                  <Input
                    label={t('emailLabel')}
                    type="email"
                    required
                    autoComplete="email webauthn"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4" />}
                    helperText={t('emailPasskeyHelper')}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 h-12 text-sm font-semibold flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    <Fingerprint className="w-5 h-5 shrink-0" />
                    <span>
                      {loading
                        ? t('activatingBiometrics')
                        : validatedCourtesy
                          ? t('createWithPlan', { planName: validatedCourtesy.planName })
                          : t('createWithPasskey')}
                    </span>
                  </Button>

                  {passkeyStatus && (
                    <p className="text-xs text-amber-400 text-center font-medium animate-pulse">
                      {passkeyStatus}
                    </p>
                  )}
                </form>
              ) : (
                /* Formulario Email + Password (Login o Registro tradicional) */
                <form noValidate onSubmit={handleEmailAuth} className="space-y-4">
                  {mode === 'register' && (
                    <Input
                      label={t('fullNameLabel')}
                      type="text"
                      placeholder={t('namePlaceholder')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      leftIcon={<User className="w-4 h-4" />}
                    />
                  )}

                  <Input
                    label={t('emailLabel')}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4" />}
                  />

                  <Input
                    label={t('passwordLabel')}
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                    helperText={mode === 'register' ? t('passwordMinHelper') : undefined}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 h-12 text-sm font-semibold"
                    disabled={loading}
                  >
                    {loading
                      ? t('verifying')
                      : mode === 'login'
                        ? t('enterApp')
                        : validatedCourtesy
                          ? t('createWithPlan', { planName: validatedCourtesy.planName })
                          : t('createWithPassword')}
                  </Button>
                </form>
              )}

              <div className="mt-5 text-center text-sm text-slate-400">
                {mode === 'login' ? (
                  <>
                    {t('noAccount')}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register')
                        setErrorMessage(null)
                        setInfoMessage(null)
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      {t('viewPlansRegister')}
                    </button>
                  </>
                ) : (
                  <>
                    {t('haveAccount')}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login')
                        setErrorMessage(null)
                        setInfoMessage(null)
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      {t('signInLink')}
                    </button>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  )
}
