'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function Loading() {
  const t = useTranslations('common')
  return (
    <main className="h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-hidden="true" />
      <p className="text-sm">{t('loadingApp')}</p>
    </main>
  )
}
