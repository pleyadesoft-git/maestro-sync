'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card, CardHeader, CardTitle, CardDescription, Input } from '@music-flow/ui'
import { createBrowserClient, getAdminPublicUrl } from '@music-flow/supabase'
import {
  Music,
  Play,
  PlusCircle,
  LogIn,
  LogOut,
  Sparkles,
  BookOpen,
  Shield,
  AlertCircle,
  Loader2,
  Lock,
  CreditCard,
  Scale,
} from 'lucide-react'
import { createRoomForVersion, fetchAnyOwnedVersion } from '../../lib/rooms'
import PWAInstallButton from '../components/PWAInstallButton'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params)
  const t = useTranslations('home')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const supabase = createBrowserClient()
  const [roomCode, setRoomCode] = useState('')
  const [roomError, setRoomError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [adminUrl] = useState(() =>
    typeof window !== 'undefined'
      ? getAdminPublicUrl(window.location.origin)
      : getAdminPublicUrl()
  )

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setCurrentUserEmail(data.user?.email ?? null)
      setAuthChecking(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setCurrentUserEmail(session?.user?.email ?? null)
      setAuthChecking(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const redirectToLogin = (targetPath: string) => {
    router.push(
      `/${locale}/login?next=${encodeURIComponent(targetPath)}&reason=auth_required`
    )
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = roomCode.trim()
    if (!trimmed) {
      setRoomError(t('roomCodeRequired'))
      return
    }
    if (!/^[A-Za-z0-9-]{4,10}$/.test(trimmed)) {
      setRoomError(t('roomCodeInvalid'))
      return
    }

    const targetUrl = `/${locale}/session/${trimmed.toUpperCase()}`
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      redirectToLogin(targetUrl)
      return
    }

    router.push(targetUrl)
  }

  const handleCreateQuickRoom = async () => {
    if (creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        redirectToLogin(`/${locale}/library`)
        return
      }

      const owned = await fetchAnyOwnedVersion(supabase)
      if (!owned) {
        setCreateError(t('noScoresError'))
        return
      }
      const result = await createRoomForVersion(supabase, owned.versionId, owned.tempo)
      if (!result.ok) {
        if (result.kind === 'auth') {
          redirectToLogin(`/${locale}/library`)
          return
        }
        setCreateError(result.message)
        return
      }
      router.push(`/${locale}/session/${result.roomCode}`)
    } catch (e: any) {
      setCreateError(e?.message || t('createRoomError'))
    } finally {
      setCreating(false)
    }
  }

  const handleGoToLibrary = async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      redirectToLogin(`/${locale}/library`)
      return
    }
    router.push(`/${locale}/library`)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentUserEmail(null)
  }

  return (
    <main className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-amber-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Badges & Install Action */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-wider uppercase shadow-sm shadow-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('badge')}</span>
        </div>
        <PWAInstallButton />
        <LanguageSwitcher />
        {!authChecking && currentUserEmail && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono">{currentUserEmail}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-1 text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1"
              title={t('signOutTitle')}
              aria-label={t('signOutTitle')}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Hero Title */}
      <div className="max-w-3xl text-center mb-10">
        <div className="flex items-center justify-center gap-3.5 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt={tCommon('logoAlt')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-amber-500/30 shadow-xl shadow-amber-950/40"
          />
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-100 tracking-tight leading-tight">
            Maestro<span className="text-amber-500">Sync</span>
          </h1>
        </div>
        <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
          {t('heroDesc')}
        </p>
        {!authChecking && !currentUserEmail && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs text-slate-300">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {t('authPromptPrefix')}{' '}
              <Link href={`/${locale}/login`} className="text-amber-400 font-semibold underline hover:text-amber-300">
                {t('authPromptLink')}
              </Link>
              .
            </span>
          </div>
        )}
      </div>

      {/* Interactive Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Join Session Card */}
        <Card className="flex flex-col justify-between border-amber-500/20 hover:border-amber-500/40 transition-all">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <CardTitle>{t('joinTitle')}</CardTitle>
            <CardDescription>{t('joinDesc')}</CardDescription>
          </CardHeader>
          <form noValidate onSubmit={handleJoinRoom} className="space-y-4">
            <Input
              required
              minLength={4}
              placeholder={t('roomCodePlaceholder')}
              value={roomCode}
              errorMessage={roomError || undefined}
              onChange={(e) => {
                setRoomCode(e.target.value)
                if (roomError) setRoomError(null)
              }}
              className="h-12 uppercase tracking-widest font-mono text-center text-lg font-bold"
            />
            <Button type="submit" variant="primary" className="w-full">
              {!authChecking && !currentUserEmail ? t('loginAndJoin') : t('enterRoom')}
            </Button>
          </form>
        </Card>

        {/* Create Session Card */}
        <Card className="flex flex-col justify-between hover:border-slate-700 transition-all">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 mb-2">
              <PlusCircle className="w-6 h-6" />
            </div>
            <CardTitle>{t('directorTitle')}</CardTitle>
            <CardDescription>{t('directorDesc')}</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <Button onClick={() => void handleCreateQuickRoom()} variant="secondary" className="w-full" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('creatingRoom')}
                </>
              ) : !authChecking && !currentUserEmail ? (
                t('loginToDirect')
              ) : (
                t('createQuickRoom')
              )}
            </Button>
            {createError && (
              <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoToLibrary()}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              {t('chooseFromLibrary')}
            </Button>
          </div>
        </Card>
      </div>

      {/* Navigation Footer */}
      <footer className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
        <Link href={`/${locale}/login`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <LogIn className="w-4 h-4" />
          <span>{currentUserEmail ? t('switchAccount') : t('loginOrRegister')}</span>
        </Link>
        <span>•</span>
        <button
          type="button"
          onClick={() => void handleGoToLibrary()}
          className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer"
        >
          <Music className="w-4 h-4" />
          <span>{t('myLibrary')}</span>
        </button>
        <span>•</span>
        <Link href={`/${locale}/pricing`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <CreditCard className="w-4 h-4" />
          <span>{t('plansAndCourtesy')}</span>
        </Link>
        <span>•</span>
        <a href={adminUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <Shield className="w-4 h-4" />
          <span>{t('adminPanel')}</span>
        </a>
        <span>•</span>
        <Link href={`/${locale}/legal`} className="flex items-center gap-1.5 hover:text-amber-400 transition-colors">
          <Scale className="w-4 h-4" />
          <span>{t('legalNotice')}</span>
        </Link>
      </footer>
    </main>
  )
}

