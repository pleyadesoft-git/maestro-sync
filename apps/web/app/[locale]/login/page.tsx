'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
} from 'lucide-react'
import {
  performWebAuthnRegister,
  performWebAuthnLogin,
  isWebAuthnSupported,
} from '../../../lib/webauthn-client'

type AuthMode = 'login' | 'register' | 'confirm_pending'

function friendlyAuthError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.'
  if (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('user already exists')
  ) {
    return 'Ese correo ya está registrado en MaestroSync. Inicia sesión con él.'
  }
  if (m.includes('password should be at least') || m.includes('password is too short')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Demasiados intentos de envío. Espera un minuto antes de reintentar.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión o la configuración de Supabase.'
  }
  if (m.includes('placeholder')) return 'Supabase no está configurado: completa el archivo .env.'
  return message || 'Error inesperado de autenticación.'
}

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()

  const [mode, setMode] = useState<AuthMode>('login')
  const [registerMethod, setRegisterMethod] = useState<'passkey' | 'password'>('passkey')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const errorParam = searchParams.get('error')
  const confirmedParam = searchParams.get('confirmed')

  const initialError =
    errorParam === 'token_expired'
      ? 'El enlace de confirmación ha expirado o ya fue utilizado. Puedes solicitar uno nuevo.'
      : null
  const initialInfo =
    confirmedParam === 'true'
      ? '¡Correo confirmado con éxito! Ya puedes iniciar sesión.'
      : null

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError)
  const [infoMessage, setInfoMessage] = useState<string | null>(initialInfo)
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null)

  // Temporizador para reenvío de correo de confirmación
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)

  // Manejo del contador de cooldown para reenvío
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const finishLogin = async (userId: string, userEmail: string) => {
    const supabase = createBrowserClient()
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (token) {
          const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          const json = await res.json()
          if (json.ok && json.profile) {
            profile = json.profile
          }
        }
      } catch {
        /* fallback silencioso */
      }
    }

    setAuth({ id: userId, email: userEmail }, profile)
    router.push(`/${locale}/library`)
  }

  // --- WebAuthn / Passkeys: Login ---
  const handlePasskeyLogin = async () => {
    setErrorMessage(null)
    setInfoMessage(null)
    setPasskeyStatus('Iniciando biometría (Face ID / Touch ID)…')
    setLoading(true)

    if (!isWebAuthnSupported()) {
      setLoading(false)
      setPasskeyStatus(null)
      setErrorMessage('Tu navegador o dispositivo no soporta Passkeys.')
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
          result.error ||
            'No se encontró una Passkey registrada en este dispositivo para MaestroSync.'
        )
        return
      }

      setPasskeyStatus('Acceso biométrico concedido. Entrando…')
      await finishLogin(result.user.id, result.user.email || email)
    } catch (err: any) {
      setPasskeyStatus(null)
      setLoading(false)
      setErrorMessage(friendlyAuthError(err?.message || 'Error en autenticación WebAuthn.'))
    }
  }

  // --- WebAuthn / Passkeys: Registro ---
  const handlePasskeyRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Introduce un correo electrónico válido para asociar a tu Passkey.')
      return
    }

    if (!isWebAuthnSupported()) {
      setErrorMessage('Este navegador o dispositivo no es compatible con Passkeys.')
      return
    }

    setLoading(true)
    setPasskeyStatus('Configurando credencial biométrica…')

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
        setErrorMessage(result.error || 'No se pudo completar el registro biométrico.')
        return
      }

      setPasskeyStatus('¡Cuenta y Passkey creadas con éxito! Entrando…')
      await finishLogin(result.user.id, result.user.email || trimmedEmail)
    } catch (err: any) {
      setPasskeyStatus(null)
      setLoading(false)
      setErrorMessage(friendlyAuthError(err?.message || 'Error en registro con Passkey.'))
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

    setLoading(true)
    setErrorMessage(null)
    setInfoMessage(null)
    const supabase = createBrowserClient()

    try {
      if (mode === 'register') {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/confirm?next=/${locale}/library`
            : undefined

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { full_name: fullName.trim() || email.split('@')[0] },
          },
        })

        if (error) {
          setErrorMessage(friendlyAuthError(error.message))
          return
        }

        // Si el usuario ya estaba registrado en Supabase, identities viene vacío
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setErrorMessage(
            'Ese correo ya está registrado en MaestroSync. Inicia sesión con tu contraseña o con Passkey.'
          )
          setMode('login')
          return
        }

        // Si se inició sesión inmediatamente (auto-confirm activo en Supabase)
        if (data.session && data.user) {
          await finishLogin(data.user.id, data.user.email ?? email)
          return
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
          friendlyAuthError(json.error || 'No se pudo reenviar el correo de confirmación.')
        )
      } else if (json.alreadyConfirmed) {
        setInfoMessage('Tu cuenta ya está confirmada. Inicia sesión directamente.')
        setMode('login')
      } else {
        setInfoMessage('Se ha reenviado el correo de confirmación. Revisa tu bandeja y spam.')
        setResendCooldown(60)
      }
    } catch (err: any) {
      setErrorMessage(friendlyAuthError(err?.message || 'Error de red al reenviar el correo.'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative">
      <Link
        href={`/${locale}`}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver</span>
      </Link>

      <Card className="max-w-md w-full border-amber-500/20 shadow-2xl shadow-amber-950/20">
        {/* ================= VISTA: CONFIRMACIÓN PENDIENTE ================= */}
        {mode === 'confirm_pending' ? (
          <div className="py-2 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Mail className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-100">¡Revisa tu bandeja de entrada!</h2>
              <p className="mt-2 text-sm text-slate-400">
                Hemos enviado un enlace de confirmación a:
              </p>
              <p className="text-base font-semibold text-amber-400 mt-1">{email}</p>
            </div>

            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-400">
                <Info className="w-4 h-4 shrink-0" />
                <span>Instrucciones para activar tu cuenta:</span>
              </div>
              <p>
                1. Abre tu correo y haz clic en el enlace para validar tu dirección.
              </p>
              <p>
                2. Si no ves el mensaje en unos instantes, <strong>revisa tu carpeta de Spam o Correo no deseado</strong>.
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
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${resendLoading ? 'animate-spin' : ''}`}
                />
                {resendCooldown > 0
                  ? `Reenviar correo en ${resendCooldown}s`
                  : 'Reenviar correo de confirmación'}
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
                <span>Volver al inicio de sesión</span>
              </Button>
            </div>
          </div>
        ) : (
          /* ================= VISTA: LOGIN / REGISTRO ================= */
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl">
                {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? 'Accede a tus partituras y sincroniza salas de orquesta en vivo.'
                  : 'Regístrate para crear salas de ensayo y subir tus partituras.'}
              </CardDescription>
            </CardHeader>

            {/* SECCIÓN WEBAUTHN / BIOMETRÍA */}
            {mode === 'login' ? (
              <div className="mb-6">
                <Button
                  onClick={handlePasskeyLogin}
                  variant="secondary"
                  className="w-full h-13 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10 transition-all group"
                  disabled={loading}
                >
                  <Fingerprint className="w-5 h-5 text-amber-400 mr-2.5 transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-slate-100">
                    Acceso Rápido con Passkey / Biometría
                  </span>
                </Button>
                {passkeyStatus && (
                  <p className="text-xs text-amber-400/90 text-center mt-2 font-medium animate-pulse">
                    {passkeyStatus}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Face ID, Touch ID o código QR (requiere Bluetooth activo en ambos dispositivos).
                </p>
              </div>
            ) : (
              /* En modo registro: Selector de método de registro (Passkey vs Contraseña) */
              <div className="mb-5 space-y-3">
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterMethod('passkey')
                      setErrorMessage(null)
                    }}
                    className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      registerMethod === 'passkey'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>Con Passkey (Recomendado)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterMethod('password')
                      setErrorMessage(null)
                    }}
                    className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      registerMethod === 'password'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Con Contraseña</span>
                  </button>
                </div>

                {registerMethod === 'passkey' && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Crea tu cuenta al instante con Face ID, Touch ID o Windows Hello. No requiere contraseña y está lista para atriles.
                    </span>
                  </div>
                )}
              </div>
            )}

            {mode === 'login' && (
              <div className="relative flex items-center justify-center mb-6">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider absolute">
                  O con Correo y Contraseña
                </span>
              </div>
            )}

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
                className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* FORMULARIOS */}
            {mode === 'register' && registerMethod === 'passkey' ? (
              /* Formulario Registro con Passkey */
              <form noValidate onSubmit={handlePasskeyRegister} className="space-y-4">
                <Input
                  label="Nombre o Músico (Opcional)"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                />

                <Input
                  label="Correo Electrónico"
                  type="email"
                  required
                  autoComplete="email webauthn"
                  placeholder="musico@orquesta.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  helperText="Se asociará a tu Passkey biométrica."
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 h-12 text-sm font-semibold"
                  disabled={loading}
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  {loading
                    ? 'Activando Biometría…'
                    : 'Crear Cuenta con Passkey / Biometría'}
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
                    label="Nombre Completo"
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                  />
                )}

                <Input
                  label="Correo Electrónico"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="musico@orquesta.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Contraseña"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  helperText={mode === 'register' ? 'Mínimo 6 caracteres' : undefined}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 h-12 text-sm font-semibold"
                  disabled={loading}
                >
                  {loading
                    ? 'Verificando…'
                    : mode === 'login'
                      ? 'Entrar a MaestroSync'
                      : 'Crear mi cuenta con contraseña'}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center text-sm text-slate-400">
              {mode === 'login' ? (
                <>
                  ¿Aún no tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setErrorMessage(null)
                      setInfoMessage(null)
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                      setInfoMessage(null)
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Card>
    </main>
  )
}
