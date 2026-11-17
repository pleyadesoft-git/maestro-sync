'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@music-flow/supabase'
import { verifyAdminAccess } from '../../admin-actions'
import { Loader2, ShieldAlert, LogOut } from 'lucide-react'
import { Button } from '@music-flow/ui'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error_description') || searchParams.get('error')
  const [asyncError, setAsyncError] = useState<string | null>(null)

  const errorMessage = urlError || asyncError

  useEffect(() => {
    if (urlError) return

    const supabase = createBrowserClient()
    let active = true

    const verifySession = async (token: string) => {
      try {
        await verifyAdminAccess(token)
        if (active) {
          router.replace('/')
        }
      } catch (err: any) {
        const msg = String(err?.message || err)
        if (active) {
          if (msg.includes('forbidden') || msg.includes('unauthorized_email')) {
            setAsyncError(
              'Acceso denegado: Esta cuenta de Google no se encuentra en la lista autorizada de SUPER_ADMIN_BOOTSTRAP_EMAILS.'
            )
            await supabase.auth.signOut()
          } else {
            setAsyncError('No se pudo verificar el acceso: ' + msg)
          }
        }
      }
    }

    const handleCallback = async () => {
      const code = searchParams.get('code')
      if (code) {
        try {
          const { data: exchangeData, error: exchangeErr } =
            await supabase.auth.exchangeCodeForSession(code)
          if (!exchangeErr && exchangeData.session?.access_token) {
            await verifySession(exchangeData.session.access_token)
            return
          }
        } catch {
          // Si ya fue intercambiado automáticamente por el cliente, continuar a getSession
        }
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) {
        if (active) setAsyncError(error.message)
        return
      }

      if (data.session?.access_token) {
        await verifySession(data.session.access_token)
        return
      }

      // Si aún no está listo el token en la primera comprobación (flujo de intercambio de código),
      // esperar al evento SIGNED_IN de Supabase Auth
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.access_token) {
          listener.subscription.unsubscribe()
          await verifySession(session.access_token)
        }
      })

      const timeout = setTimeout(() => {
        if (active) {
          setAsyncError('Tiempo de espera agotado al verificar la sesión de Google.')
        }
      }, 10000)

      return () => {
        listener.subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    handleCallback()

    return () => {
      active = false
    }
  }, [router, urlError, searchParams])

  const handleReturnToLogin = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-xl font-bold text-slate-100">Acceso no autorizado</h1>
          <p className="text-sm text-slate-400">{errorMessage}</p>
        </div>
        <Button onClick={handleReturnToLogin} variant="secondary">
          <LogOut className="w-4 h-4 mr-2" />
          Volver e intentar con otra cuenta
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      <p className="text-sm text-slate-400">Verificando credenciales de Super Admin…</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-slate-400">Cargando…</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
