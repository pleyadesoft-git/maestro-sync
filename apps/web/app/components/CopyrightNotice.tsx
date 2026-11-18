import React from 'react'
import Link from 'next/link'
import { Scale } from 'lucide-react'

export const COPYRIGHT_DISCLAIMER_SHORT =
  'MaestroSync es una herramienta de lectura y sincronización. No proporciona, distribuye ni verifica licencias de partituras. El usuario es el único responsable de contar con los derechos o permisos necesarios sobre las obras que sube, usa o comparte.'

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
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-xs text-slate-300 ${className}`}
    >
      <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="leading-relaxed">
        {COPYRIGHT_DISCLAIMER_SHORT}{' '}
        <Link
          href={`/${locale}/legal`}
          target="_blank"
          className="text-amber-400 underline hover:text-amber-300 font-semibold"
        >
          Leer aviso legal completo
        </Link>
        .
      </p>
    </div>
  )
}
