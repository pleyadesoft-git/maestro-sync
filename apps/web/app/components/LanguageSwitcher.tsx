'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'
import { locales, type Locale } from '@music-flow/i18n'
import { createBrowserClient } from '@music-flow/supabase'
import { useAuthStore } from '@music-flow/stores'

const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: Locale
  shortLabel: string
  nativeName: string
}> = [
  { code: 'es', shortLabel: 'ES', nativeName: 'Español' },
  { code: 'en', shortLabel: 'EN', nativeName: 'English' },
]

interface LanguageSwitcherProps {
  className?: string
  compact?: boolean
}

function persistLocalePreference(nextLocale: Locale) {
  if (typeof document === 'undefined') return
  try {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`
    window.localStorage.setItem('maestro_preferred_locale', nextLocale)
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export default function LanguageSwitcher({
  className = '',
  compact = false,
}: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale
  const t = useTranslations('common')
  const pathname = usePathname()
  const router = useRouter()

  const handleSelectLocale = (nextLocale: Locale) => {
    if (nextLocale === currentLocale) return

    // 1. Persist preference for visitors & next-intl middleware
    persistLocalePreference(nextLocale)

    // 2. Sync Zustand auth store
    useAuthStore.getState().setLanguage(nextLocale)

    // 3. If logged in, persist preferred_language to profile in background
    try {
      const supabase = createBrowserClient()
      void supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return
        void supabase
          .from('profiles')
          .update({ preferred_language: nextLocale })
          .eq('id', data.user.id)
      })
    } catch {
      // Non-blocking
    }

    // 4. Navigate to same path under the selected locale, preserving query & hash
    const localePrefixRegex = new RegExp(`^/(${locales.join('|')})(?=/|$)`)
    const pathWithoutLocale = pathname ? pathname.replace(localePrefixRegex, '') : ''
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const targetUrl = `/${nextLocale}${pathWithoutLocale || ''}${search}${hash}`

    router.replace(targetUrl)
    router.refresh()
  }

  return (
    <div
      role="group"
      aria-label={t('selectLanguage')}
      className={`inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 ${
        compact ? 'p-0.5' : 'p-1'
      } shadow-sm ${className}`}
    >
      <Globe
        aria-hidden="true"
        className={`text-slate-400 shrink-0 ${
          compact ? 'w-3.5 h-3.5 ml-1.5 mr-0.5' : 'w-3.5 h-3.5 ml-2 mr-0.5'
        }`}
      />
      {LANGUAGE_OPTIONS.map((option) => {
        const isActive = currentLocale === option.code
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            aria-pressed={isActive}
            onClick={() => handleSelectLocale(option.code)}
            className={`inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2 ${
              compact
                ? 'min-h-[28px] min-w-[32px] px-2 text-[11px]'
                : 'min-h-[32px] min-w-[36px] px-2.5 text-xs'
            } ${
              isActive
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
          >
            <span>{option.shortLabel}</span>
            <span className="sr-only"> — {option.nativeName}</span>
          </button>
        )
      })}
    </div>
  )
}
