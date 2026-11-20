import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { FileQuestion } from 'lucide-react'
import { messages, type Locale } from '@music-flow/i18n'

export default async function NotFound() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
  const acceptLang = headerStore.get('accept-language') || ''

  let locale: Locale = 'es'
  if (cookieLocale === 'en' || cookieLocale === 'es') {
    locale = cookieLocale
  } else if (acceptLang.toLowerCase().startsWith('en')) {
    locale = 'en'
  }

  const t = messages[locale].common

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
        <FileQuestion className="w-7 h-7 text-slate-400" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-bold text-slate-100">{t.notFoundTitle}</h1>
        <p className="text-sm text-slate-400">{t.notFoundDesc}</p>
      </div>
      <Link
        href={`/${locale}`}
        className="h-12 px-5 rounded-xl bg-amber-500 text-slate-950 font-semibold inline-flex items-center hover:bg-amber-400 transition-colors"
      >
        {t.backHome}
      </Link>
    </main>
  )
}
