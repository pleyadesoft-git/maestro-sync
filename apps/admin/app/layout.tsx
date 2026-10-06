import './globals.css'
import React from 'react'

export const metadata = {
  title: 'MaestroSync — Panel de Administración de Plataforma',
  description: 'Gestión de usuarios, suscripciones y métricas en tiempo real.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">{children}</body>
    </html>
  )
}
