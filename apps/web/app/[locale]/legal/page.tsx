import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'
import { messages } from '@music-flow/i18n'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = (messages[locale as 'es' | 'en'] || messages.es).legalPage

  const sections: Array<{ title: string; body: string[] }> = [
    { title: t.s1Title, body: [t.s1Body1] },
    { title: t.s2Title, body: [t.s2Body1, t.s2Body2, t.s2Body3] },
    { title: t.s3Title, body: [t.s3Body1, t.s3Body2] },
    { title: t.s4Title, body: [t.s4Body1] },
    { title: t.s5Title, body: [t.s5Body1] },
  ]

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-12 text-slate-100">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.backHome}</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Scale className="w-4 h-4" aria-hidden="true" />
            {t.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t.title}
          </h1>
          <p className="text-sm text-slate-400">{t.subtitle}</p>
        </header>

        <div className="space-y-6">
          {sections.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2"
            >
              <h2 className="text-base font-bold text-slate-100">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-slate-300 leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
