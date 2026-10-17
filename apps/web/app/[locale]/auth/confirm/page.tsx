'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import { useAuthStore } from '@music-flow/stores'
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react'

export default function ConfirmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    const checkConfirmation = async () => {
      // 1. Si viene token_hash en searchParams
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type') as any
      const next = searchParams.get('next') || `/${locale}/library`

      if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })

        if (cancelled) return

        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }

        if (data.user) {
          // Sincronizar perfil
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData.session?.access_token
            if (token) {
              await fetch('/api/auth/profile', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              })
            }
          } catch {
            /* ignore */
          }

          setAuth({ id: data.user.id, email: data.user.email }, null)
          setStatus('success')
          setTimeout(() => {
            router.push(next)
          }, 2000)
          return
        }
      }

      // 2. Si ya hay una sesión activa en Supabase (por hash #access_token)
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user) {
        setAuth(
          {
            id: sessionData.session.user.id,
            email: sessionData.session.user.email,
          },
          null
        )
        setStatus('success')
        setTimeout(() => {
          router.push(`/${locale}/library`)
        }, 1500)
        return
      }

      // 3. Si no hay parámetros ni sesión
      setStatus('error')
      setErrorMessage(
        'El enlace de confirmación es inválido o ha expirado. Por favor solicita uno nuevo desde la pantalla de acceso.'
      )
    }

    checkConfirmation()

    return () => {
      cancelled = true
    }
  }, [locale, router, searchParams, setAuth])

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative">
      <Card className="max-w-md w-full border-amber-500/20 text-center">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            {status === 'verifying' && <Loader2 className="w-7 h-7 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
            {status === 'error' && <AlertCircle className="w-7 h-7 text-rose-400" />}
          </div>

          <CardTitle className="text-2xl">
            {status === 'verifying' && 'Confirmando tu cuenta…'}
            {status === 'success' && '¡Cuenta confirmada con éxito!'}
            {status === 'error' && 'Enlace de confirmación no válido'}
          </CardTitle>

          <CardDescription>
            {status === 'verifying' &&
              'Estamos verificando tu enlace de seguridad de MaestroSync.'}
            {status === 'success' &&
              'Tu correo ha sido verificado. Te estamos redirigiendo a tu biblioteca de partituras…'}
            {status === 'error' &&
              (errorMessage ||
                'No se pudo verificar el correo. El enlace pudo haber expirado.')}
          </CardDescription>
        </CardHeader>

        <div className="mt-6 flex flex-col gap-3">
          {status === 'success' && (
            <Button
              onClick={() => router.push(`/${locale}/library`)}
              variant="primary"
              className="w-full"
            >
              <span>Ir a la Biblioteca ahora</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {status === 'error' && (
            <Button asChild variant="primary" className="w-full">
              <Link href={`/${locale}/login`}>
                <span>Volver a Iniciar Sesión</span>
              </Link>
            </Button>
          )}
        </div>
      </Card>
    </main>
  )
}
