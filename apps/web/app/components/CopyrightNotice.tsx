'use client'

import React from 'react'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Aviso breve de derechos de autor. Se muestra en puntos clave
 * (subida de partituras, registro) con enlace al aviso legal completo.
 */
export function CopyrightNotice({
  locale,
  className = '',
}: {
  locale: string
  className?: string
}) {
  const t = useTranslations('copyright')

  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-xs text-slate-300 ${className}`}
    >
      <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="leading-relaxed">
        {t('shortDisclaimer')}{' '}
        <Link
          href={`/${locale}/legal`}
          target="_blank"
          className="text-amber-400 underline hover:text-amber-300 font-semibold"
        >
          {t('readFullLegal')}
        </Link>
        .
      </p>
    </div>
  )
}
