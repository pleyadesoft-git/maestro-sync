'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, Input } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { useAuthStore } from '@music-flow/stores'
import { Fingerprint, Mail, Lock, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react'

type AuthMode = 'login' | 'register'

function friendlyAuthError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ese correo ya está registrado. Inicia sesión con él.'
  if (m.includes('password should be at least') || m.includes('password is too short'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.'
  if (m.includes('failed to fetch') || m.includes('networkerror'))
    return 'No se pudo contactar con el servidor. Revisa tu conexión o la configuración de Supabase.'
  if (m.includes('placeholder')) return 'Supabase no está configurado: completa el archivo .env.'
  return message || 'Error inesperado de autenticación.'
}

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null)

  const finishLogin = async (userId: string, userEmail: string) => {
    const supabase = createBrowserClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setAuth({ id: userId, email: userEmail }, profile)
    router.push(`/${locale}/library`)
  }

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } },
        })
        if (error) {
          setErrorMessage(friendlyAuthError(error.message))
          return
        }
        if (data.session && data.user) {
          await finishLogin(data.user.id, data.user.email ?? email)
        } else {
          setInfoMessage('Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.')
          setMode('login')
        }
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
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

  const handlePasskeyAuth = async () => {
    setErrorMessage(null)
    setInfoMessage(null)
    setPasskeyStatus('Verificando biometría (Face ID / Touch ID)…')

    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setPasskeyStatus('Las passkeys no son soportadas en este navegador.')
      return
    }

    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase.auth.signInWithPasskey()

      if (error) {
        setPasskeyStatus(null)
        setErrorMessage(friendlyAuthError(error.message))
        return
      }

      const user = data?.user
      if (user) {
        setPasskeyStatus('Acceso con Passkey exitoso')
        await finishLogin(user.id, user.email ?? '')
      }
    } catch (err: any) {
      setPasskeyStatus(null)
      const message = err?.message ?? ''
      if (message.toLowerCase().includes('abort')) {
        setPasskeyStatus(null)
      } else {
        setErrorMessage(friendlyAuthError(message || 'No se pudo completar la ceremonia WebAuthn.'))
      }
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

      <Card className="max-w-md w-full border-amber-500/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Accede a tu biblioteca de partituras e historial de salas.'
              : 'Regístrate para crear salas y subir tus partituras.'}
          </CardDescription>
        </CardHeader>

        {/* Passkey / Biometría */}
        <div className="mb-6">
          <Button
            onClick={handlePasskeyAuth}
            variant="secondary"
            className="w-full h-13 border-amber-500/30 hover:border-amber-500/60"
            disabled={loading}
          >
            <Fingerprint className="w-5 h-5 text-amber-400 mr-2" />
            Acceso Rápido con Passkey / Biometría
          </Button>
          {passkeyStatus && (
            <p className="text-xs text-amber-400/90 text-center mt-2 font-medium">{passkeyStatus}</p>
          )}
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider absolute">
            O con Email
          </span>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Form */}
        <form noValidate onSubmit={handleEmailAuth} className="space-y-4">
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
            helperText="Mínimo 6 caracteres"
          />

          <Button type="submit" variant="primary" className="w-full mt-2" disabled={loading}>
            {loading
              ? 'Verificando…'
              : mode === 'login'
                ? 'Entrar a MaestroSync'
                : 'Crear mi cuenta'}
          </Button>
        </form>

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
      </Card>
    </main>
  )
}
