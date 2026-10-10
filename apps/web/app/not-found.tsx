import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
        <FileQuestion className="w-7 h-7 text-slate-400" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-bold text-slate-100">Página no encontrada</h1>
        <p className="text-sm text-slate-400">
          La ruta que buscas no existe o la sala asociada ya finalizó.
        </p>
      </div>
      <Link
        href="/"
        className="h-12 px-5 rounded-xl bg-amber-500 text-slate-950 font-semibold inline-flex items-center hover:bg-amber-400 transition-colors"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
