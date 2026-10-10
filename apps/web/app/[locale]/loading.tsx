import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <main className="h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      <p className="text-sm">Cargando MaestroSync…</p>
    </main>
  )
}
