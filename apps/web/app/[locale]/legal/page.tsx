import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: '1. Naturaleza del servicio',
    body: [
      'MaestroSync es una herramienta tecnológica para la lectura, análisis y sincronización de partituras en ensayos y presentaciones. La plataforma no crea, vende, distribuye ni licencia obras musicales ni ediciones de partituras.',
    ],
  },
  {
    title: '2. Responsabilidad del usuario sobre los derechos de autor',
    body: [
      'Todo el contenido (PDF, imágenes, MusicXML u otros archivos) que el usuario sube, almacena, comparte o utiliza en MaestroSync es de su exclusiva responsabilidad.',
      'El usuario declara y garantiza que es titular de los derechos, o que cuenta con las licencias, permisos o autorizaciones necesarios (o que la obra está en dominio público en su jurisdicción) para cargar, reproducir y compartir dicho contenido con otros usuarios.',
      'Las ediciones, arreglos y transcripciones modernas de obras en dominio público pueden estar protegidas de forma independiente. Verificarlo corresponde al usuario.',
    ],
  },
  {
    title: '3. Deslinde de responsabilidad',
    body: [
      'MaestroSync no revisa previamente el contenido subido por los usuarios ni garantiza su legalidad. En la máxima medida permitida por la ley, MaestroSync y sus titulares quedan deslindados de cualquier reclamación, daño o perjuicio derivado del uso, carga o distribución de material protegido por parte de los usuarios.',
      'El usuario se obliga a mantener indemne a MaestroSync frente a reclamaciones de terceros originadas por el contenido que haya subido o compartido.',
    ],
  },
  {
    title: '4. Compartir partituras',
    body: [
      'Las funciones de compartir partituras y configuraciones entre usuarios se ofrecen únicamente para facilitar el trabajo de ensambles. Compartir material protegido sin autorización del titular de los derechos puede constituir una infracción.',
    ],
  },
  {
    title: '5. Retiro de contenido',
    body: [
      'Si eres titular de derechos y consideras que algún contenido infringe tus derechos, puedes solicitar su revisión y retiro. MaestroSync podrá eliminar contenido y suspender cuentas de quienes infrinjan derechos de terceros de forma reiterada.',
    ],
  },
]

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-slate-950 p-6 sm:p-12 text-slate-100">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </Link>

        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Scale className="w-4 h-4" />
            Aviso Legal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Derechos de autor y uso de partituras
          </h1>
          <p className="text-sm text-slate-400">
            Al utilizar MaestroSync aceptas los siguientes términos sobre el uso de partituras y material protegido.
          </p>
        </header>

        <div className="space-y-6">
          {SECTIONS.map((s) => (
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
