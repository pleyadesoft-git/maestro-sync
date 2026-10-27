import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

const INSTRUMENT_LABEL_TO_CODE: Record<string, string> = {
  'Violín I': 'violin_1',
  'Violín II': 'violin_2',
  Viola: 'viola',
  Violonchelo: 'cello',
  Contrabajo: 'contrabass',
  Flauta: 'flute',
  Piccolo: 'piccolo',
  Oboe: 'oboe',
  'Corno Inglés': 'english_horn',
  Clarinete: 'clarinet',
  'Clarinete Bajo': 'bass_clarinet',
  Fagot: 'bassoon',
  Contrafagot: 'contrabassoon',
  'Saxofón Alto': 'alto_sax',
  'Saxofón Tenor': 'tenor_sax',
  'Saxofón Barítono': 'baritone_sax',
  Corno: 'horn',
  Trompeta: 'trumpet',
  Trombón: 'trombone',
  Tuba: 'tuba',
  Eufonio: 'euphonium',
  Timbales: 'timpani',
  Percusión: 'percussion',
  Batería: 'drum_set',
  Xilófono: 'xylophone',
  Marimba: 'marimba',
  Piano: 'piano',
  Arpa: 'harp',
  Guitarra: 'guitar',
  Bajo: 'electric_bass',
  Soprano: 'soprano',
  Contralto: 'alto',
  Tenor: 'tenor',
  BajoVoz: 'bass',
  Todos: 'piano',
}

export async function POST(req: NextRequest) {
  let createdWorkId: string | null = null
  let uploadedFilePath: string | null = null
  const uploadedPagePaths: string[] = []
  const supabase = createServiceRoleClient()

  try {
    // 1. Validar autorización del usuario
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Debes iniciar sesión para subir partituras.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Tu sesión ha expirado o es inválida. Inicia sesión nuevamente.' },
        { status: 401 }
      )
    }

    // 2. Garantizar perfil de usuario en public.profiles y verificar período de prueba / suscripción
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, trial_ends_at, is_suspended')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        preferred_language: 'es',
        is_platform_admin: false,
      })
    } else if (profile.is_suspended) {
      return NextResponse.json(
        { ok: false, error: 'Tu cuenta ha sido suspendida.' },
        { status: 403 }
      )
    }

    // 3. Validar vigencia de la prueba gratuita o suscripción activa
    const trialEnds = profile?.trial_ends_at ? Date.parse(profile.trial_ends_at) : Date.now() + 15 * 86400000
    const isTrialActive = trialEnds > Date.now()

    if (!isTrialActive) {
      // Verificar suscripción activa individual u organizacional
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id, status, current_period_end')
        .or(`owner_user_id.eq.${user.id}`)
        .in('status', ['active', 'trialing'])

      const hasPaidPlan = (subs ?? []).some(
        (s) => !s.current_period_end || Date.parse(s.current_period_end) > Date.now()
      )

      if (!hasPaidPlan) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Tu período de prueba gratuita de 15 días ha finalizado. Suscríbete a un plan para continuar subiendo partituras.',
          },
          { status: 403 }
        )
      }
    }

    // 4. Extraer y validar FormData
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = ((formData.get('title') as string) || '').trim()
    const composer = ((formData.get('composer') as string) || '').trim()
    const catalogRef = ((formData.get('catalogRef') as string) || '').trim()
    const keySignature = ((formData.get('keySignature') as string) || 'C major').trim()
    const timeSignature = ((formData.get('timeSignature') as string) || '4/4').trim()
    const tempo = Math.min(320, Math.max(30, Number(formData.get('tempo')) || 120))
    const totalMeasures = Math.max(1, Number(formData.get('totalMeasures')) || 32)
    const pageCount = Math.max(1, Number(formData.get('pageCount')) || 1)
    const organizationId = ((formData.get('organizationId') as string) || '').trim() || null

    const rawParts = formData.get('parts') as string | null
    const rawPages = formData.get('pages') as string | null
    const rawPlaybackMap = formData.get('playbackMap') as string | null
    const rawPageImages = formData.get('pageImages') as string | null

    if (!file || typeof file === 'string' || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: 'Por favor selecciona un archivo de partitura válido.' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'El título de la obra es obligatorio.' },
        { status: 400 }
      )
    }

    let parsedParts: Array<{ name: string; instrumentCode?: string; partOrder?: number; deskCount?: number }> = []
    if (rawParts) {
      try {
        parsedParts = JSON.parse(rawParts)
      } catch {
        parsedParts = []
      }
    }
    if (parsedParts.length === 0) {
      parsedParts = [{ name: 'Todos', partOrder: 1, deskCount: 1 }]
    }

    let parsedPages: any[] = []
    if (rawPages) {
      try {
        parsedPages = JSON.parse(rawPages)
      } catch {
        parsedPages = []
      }
    }

    let parsedPlaybackMap: any[] = []
    if (rawPlaybackMap) {
      try {
        parsedPlaybackMap = JSON.parse(rawPlaybackMap)
      } catch {
        parsedPlaybackMap = []
      }
    }

    // 5. Subir archivo original a Supabase Storage (bucket scores)
    const rawExtension = (file.name.split('.').pop() || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const isPdf = file.type === 'application/pdf' || rawExtension === 'pdf'
    const isMusicXml = rawExtension === 'musicxml' || rawExtension === 'xml'
    const extension = rawExtension || (isPdf ? 'pdf' : isMusicXml ? 'musicxml' : 'png')

    const fileType = isPdf ? 'pdf' : isMusicXml ? 'musicxml' : 'image'
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'score'

    uploadedFilePath = `${user.id}/${crypto.randomUUID()}/${slug}.${extension}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('scores')
      .upload(uploadedFilePath, fileBuffer, {
        contentType: file.type || (isPdf ? 'application/pdf' : isMusicXml ? 'application/xml' : 'image/png'),
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Error en el almacenamiento: ${uploadError.message}`)
    }

    // 6. Subir imágenes de páginas renderizadas si fueron enviadas
    let pageImagesMap = new Map<number, string>()
    if (rawPageImages) {
      try {
        const imagesList: Array<{ pageNumber: number; dataUrl: string }> = JSON.parse(rawPageImages)
        for (const item of imagesList) {
          if (item.dataUrl && item.dataUrl.startsWith('data:image/')) {
            const base64Data = item.dataUrl.split(',')[1]
            if (base64Data) {
              const imgBuffer = Buffer.from(base64Data, 'base64')
              const pPath = `${user.id}/${crypto.randomUUID()}/${slug}-page-${item.pageNumber}.png`
              const { error: pErr } = await supabase.storage.from('scores').upload(pPath, imgBuffer, {
                contentType: 'image/png',
                upsert: true,
              })
              if (!pErr) {
                uploadedPagePaths.push(pPath)
                pageImagesMap.set(item.pageNumber, pPath)
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error subiendo imágenes de páginas:', err)
      }
    }

    // 7. Base de datos: Registrar Obra
    const { data: work, error: workError } = await supabase
      .from('works')
      .insert({
        owner_id: user.id,
        title,
        composer: composer || null,
        catalog_reference: catalogRef || null,
        key_signature: keySignature,
        time_signature: timeSignature,
        default_tempo_bpm: tempo,
        total_measures: totalMeasures,
        organization_id: organizationId,
      })
      .select('id')
      .single()

    if (workError || !work) {
      throw new Error(workError?.message || 'No se pudo crear la obra.')
    }
    createdWorkId = work.id

    // 8. Registrar Versión con playback_map
    const { data: version, error: versionError } = await (supabase as any)
      .from('work_versions')
      .insert({
        work_id: work.id,
        version_name: 'Original',
        tempo_bpm_override: tempo,
        total_measures_override: totalMeasures,
        playback_map: parsedPlaybackMap,
      })
      .select('id')
      .single()

    if (versionError || !version) {
      throw new Error(versionError?.message || 'No se pudo crear la versión.')
    }

    // 9. Registrar Partes (instrumentos de la obra)
    const { data: instruments } = await supabase.from('instruments').select('id, code')
    const instrumentByCode = new Map<string, string>()
    for (const inst of instruments ?? []) {
      instrumentByCode.set(inst.code, inst.id)
    }

    const partRows = parsedParts.map((p, idx) => {
      const code = p.instrumentCode || INSTRUMENT_LABEL_TO_CODE[p.name]
      const instId = code ? instrumentByCode.get(code) ?? null : null
      return {
        work_version_id: version.id,
        instrument_id: instId,
        name: p.name,
        part_order: p.partOrder || idx + 1,
        desk_count: p.deskCount || 1,
      }
    })

    const { data: insertedParts, error: partsError } = await (supabase as any)
      .from('parts')
      .insert(partRows)
      .select('id, name')

    if (partsError) {
      console.warn('Error registrando partes:', partsError)
    }

    const partIdByName = new Map<string, string>()
    for (const ip of insertedParts ?? []) {
      partIdByName.set(ip.name, ip.id)
    }

    // 10. Registrar Score
    const { data: score, error: scoreError } = await (supabase as any)
      .from('scores')
      .insert({
        work_version_id: version.id,
        owner_id: user.id,
        file_path: uploadedFilePath,
        file_type: fileType,
        page_count: Math.max(pageCount, parsedPages.length || 1),
        status: 'ready',
        omr_engine: isMusicXml ? 'musicxml' : 'auto',
      })
      .select('id')
      .single()

    if (scoreError || !score) {
      throw new Error(scoreError?.message || 'No se pudo registrar la partitura.')
    }

    // 11. Registrar Páginas, Sistemas, Staves y Measures
    const totalPgCount = Math.max(pageCount, parsedPages.length || 1)

    for (let pNum = 1; pNum <= totalPgCount; pNum++) {
      const pageImagePath = pageImagesMap.get(pNum) || uploadedFilePath
      const pageData = parsedPages.find((p) => p.pageNumber === pNum)

      const { data: pageRecord, error: pageErr } = await supabase
        .from('score_pages')
        .insert({
          score_id: score.id,
          page_number: pNum,
          image_path: pageImagePath,
          width_px: pageData?.widthPx || null,
          height_px: pageData?.heightPx || null,
        })
        .select('id')
        .single()

      if (pageErr || !pageRecord) {
        console.warn(`Error registrando página ${pNum}:`, pageErr)
        continue
      }

      // Sistemas dentro de esta página
      const systemsList = pageData?.systems || []
      for (const sys of systemsList) {
        const firstStaff = sys.staves?.[0]
        const sysPartName = firstStaff?.partName || 'Todos'
        const sysPartId = partIdByName.get(sysPartName) || (insertedParts?.[0]?.id ?? null)
        const sysInstCode = INSTRUMENT_LABEL_TO_CODE[sysPartName]
        const sysInstId = sysInstCode ? instrumentByCode.get(sysInstCode) ?? null : null

        const { data: systemRecord, error: sysErr } = await (supabase as any)
          .from('score_systems')
          .insert({
            score_page_id: pageRecord.id,
            instrument_id: sysInstId,
            system_order: sys.systemOrder || 1,
            measure_start: sys.measureStart || 1,
            measure_count: sys.measureCount || 4,
            bbox_x: sys.bboxX,
            bbox_y: sys.bboxY,
            bbox_w: sys.bboxW,
            bbox_h: sys.bboxH,
            confidence: sys.confidence || 0.8,
            detection_source: isMusicXml ? 'musicxml' : 'auto',
            is_manually_corrected: true,
          })
          .select('id')
          .single()

        if (sysErr || !systemRecord) {
          console.warn('Error registrando sistema:', sysErr)
          continue
        }

        // Staves dentro del sistema
        if (sys.staves && sys.staves.length > 0) {
          const stavesRows = sys.staves.map((st: any, sIdx: number) => {
            const pId = (st.partName && partIdByName.get(st.partName)) || sysPartId
            return {
              score_system_id: systemRecord.id,
              part_id: pId,
              staff_order: st.staffOrder || sIdx + 1,
              bbox_x: st.bboxX,
              bbox_y: st.bboxY,
              bbox_w: st.bboxW,
              bbox_h: st.bboxH,
            }
          })
          await (supabase as any).from('score_staves').insert(stavesRows)
        }

        // Measures dentro del sistema
        if (sys.measures && sys.measures.length > 0) {
          const measuresRows = sys.measures.map((m: any) => ({
            score_system_id: systemRecord.id,
            measure_number: m.measureNumber,
            x_start: m.xStart,
            x_end: m.xEnd,
          }))
          await (supabase as any).from('score_measures').insert(measuresRows)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      workId: work.id,
      versionId: version.id,
      message: 'Partitura procesada y guardada con éxito.',
    })
  } catch (err: any) {
    // Rollback best-effort en caso de error
    if (createdWorkId) {
      try {
        await supabase.from('works').delete().eq('id', createdWorkId)
      } catch {
        /* best effort */
      }
    }
    if (uploadedFilePath) {
      try {
        await supabase.storage.from('scores').remove([uploadedFilePath, ...uploadedPagePaths])
      } catch {
        /* best effort */
      }
    }

    return NextResponse.json(
      { ok: false, error: err?.message || 'Error inesperado al guardar la partitura.' },
      { status: 500 }
    )
  }
}
