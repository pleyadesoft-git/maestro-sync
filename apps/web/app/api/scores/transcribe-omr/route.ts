import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, transcribeScorePagesToMusicXml } from '@music-flow/supabase/server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Debes iniciar sesión para transcribir partituras.' },
        { status: 401 }
      )
    }

    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token)

    if (authErr || !user) {
      return NextResponse.json(
        { ok: false, error: 'Sesión inválida o expirada.' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))

    // Modo A: Transcribir una versión existente en BD (workVersionId) y guardar el MusicXML en Storage
    if (typeof body?.workVersionId === 'string' && body.workVersionId.trim()) {
      const workVersionId = body.workVersionId.trim()

      const { data: version } = await supabase
        .from('work_versions')
        .select(
          `id, version_name, tempo_bpm_override,
           works ( id, owner_id, title, composer, key_signature, time_signature, default_tempo_bpm )`
        )
        .eq('id', workVersionId)
        .maybeSingle()

      if (!version) {
        return NextResponse.json({ ok: false, error: 'Versión de obra no encontrada.' }, { status: 404 })
      }

      const work = version.works as any

      const { data: scores } = await supabase
        .from('scores')
        .select('id, file_path, file_type, page_count')
        .eq('work_version_id', workVersionId)
        .order('created_at', { ascending: false })

      const sourceScore = (scores ?? []).find((s) => s.file_type !== 'musicxml' && s.file_type !== 'mxl')
      if (!sourceScore) {
        return NextResponse.json(
          { ok: false, error: 'No se encontró una partitura PDF/imagen fuente para transcribir.' },
          { status: 404 }
        )
      }

      // Preferir el PDF original para renderizar a 300 DPI nítidos en homr; si es imagen, usar score_pages
      let pdfBuffer: Buffer | null = null
      const images: string[] = []

      if (sourceScore.file_type === 'pdf' && sourceScore.file_path) {
        const { data: pdfBlob } = await supabase.storage.from('scores').download(sourceScore.file_path)
        if (pdfBlob) {
          pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())
        }
      }

      if (!pdfBuffer) {
        const { data: pages } = await supabase
          .from('score_pages')
          .select('id, page_number, image_path')
          .eq('score_id', sourceScore.id)
          .order('page_number', { ascending: true })

        for (const p of (pages ?? []).slice(0, 12)) {
          if (!p.image_path) continue
          const { data: blob, error: dlErr } = await supabase.storage.from('scores').download(p.image_path)
          if (dlErr || !blob) continue
          const buf = Buffer.from(await blob.arrayBuffer())
          const mime = p.image_path.toLowerCase().endsWith('.jpg') || p.image_path.toLowerCase().endsWith('.jpeg')
            ? 'image/jpeg'
            : 'image/png'
          images.push(`data:${mime};base64,${buf.toString('base64')}`)
        }
      }

      if (!pdfBuffer && images.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No se pudo descargar el PDF ni las páginas de la partitura desde Storage.' },
          { status: 500 }
        )
      }

      const omrResult = await transcribeScorePagesToMusicXml({
        pdfBuffer,
        images,
        hints: {
          title: work?.title || undefined,
          composer: work?.composer || undefined,
          keySignature: work?.key_signature || undefined,
          timeSignature: work?.time_signature || undefined,
          tempoBpm: version.tempo_bpm_override || work?.default_tempo_bpm || undefined,
          instruments: Array.isArray(body?.instruments) ? body.instruments : ['Piano'],
        },
      })

      // Guardar el MusicXML generado en Supabase Storage y registrarlo en public.scores
      const xmlStoragePath = `${user.id}/${workVersionId}/omr-score-${Date.now()}.musicxml`
      const xmlBuffer = Buffer.from(omrResult.musicXml, 'utf-8')
      const { error: uploadErr } = await supabase.storage
        .from('scores')
        .upload(xmlStoragePath, xmlBuffer, {
          contentType: 'application/vnd.recordare.musicxml+xml',
          upsert: true,
        })

      if (uploadErr) {
        throw new Error(`No se pudo guardar el MusicXML generado: ${uploadErr.message}`)
      }

      const { data: xmlScoreRow, error: insertScoreErr } = await supabase
        .from('scores')
        .insert({
          work_version_id: workVersionId,
          owner_id: work?.owner_id || user.id,
          file_path: xmlStoragePath,
          file_type: 'musicxml',
          page_count: omrResult.pagesTranscribed,
        })
        .select('id')
        .single()

      if (insertScoreErr) {
        throw new Error(`No se pudo registrar la partitura MusicXML: ${insertScoreErr.message}`)
      }

      // Registrar auditoría en omr_jobs
      await supabase.from('omr_jobs').insert({
        score_id: xmlScoreRow.id,
        engine: `vision-ai:${omrResult.providerUsed}`,
        status: 'done',
        raw_output: {
          pagesTranscribed: omrResult.pagesTranscribed,
          measuresExtracted: omrResult.measuresExtracted,
          warnings: omrResult.warnings,
        },
        completed_at: new Date().toISOString(),
      })

      const { data: signed } = await supabase.storage
        .from('scores')
        .createSignedUrl(xmlStoragePath, 7200)

      return NextResponse.json({
        ok: true,
        musicXmlUrl: signed?.signedUrl ?? null,
        musicXml: omrResult.musicXml,
        providerUsed: omrResult.providerUsed,
        pagesTranscribed: omrResult.pagesTranscribed,
        measuresExtracted: omrResult.measuresExtracted,
        warnings: omrResult.warnings,
      })
    }

    // Modo B: Transcripción directa desde imágenes en /upload antes de guardar
    const images = Array.isArray(body?.images)
      ? body.images.filter((x: unknown) => typeof x === 'string').slice(0, 8)
      : []

    if (images.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere workVersionId o un arreglo de imágenes.' },
        { status: 400 }
      )
    }

    const result = await transcribeScorePagesToMusicXml({
      images,
      hints: body?.hints,
    })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[transcribe-omr] Error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'No se pudo transcribir la partitura a MusicXML.' },
      { status: 500 }
    )
  }
}
