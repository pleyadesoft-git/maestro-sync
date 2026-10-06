import '../globals.css'
import React from 'react'
import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { messages } from '@music-flow/i18n'
import PWAUpdateNotification from '../components/PWAUpdateNotification'

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'MaestroSync — Lectura Sincronizada de Partituras',
  description: 'App PWA para orquestas y agrupaciones musicales con resaltado en tiempo real.',
  manifest: '/manifest.json',
  applicationName: 'MaestroSync',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MaestroSync',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const currentMessages = messages[locale as 'es' | 'en'] || messages.es

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 antialiased">
        <NextIntlClientProvider locale={locale} messages={currentMessages}>
          {children}
        </NextIntlClientProvider>
        <PWAUpdateNotification />
      </body>
    </html>
  )
}
