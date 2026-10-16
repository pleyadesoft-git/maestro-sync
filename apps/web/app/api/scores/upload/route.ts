import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@music-flow/supabase/server'

const FREE_SCORE_LIMIT = 2

const INSTRUMENT_LABEL_TO_CODE: Record<string, string> = {
  'Violín I': 'violin_1',
  'Violín II': 'violin_2',
  Viola: 'viola',
  Violonchelo: 'cello',
  Contrabajo: 'contrabass',
  Flauta: 'flute',
  Oboe: 'oboe',
  Clarinete: 'clarinet',
  Fagot: 'bassoon',
  Corno: 'horn',
  Trompeta: 'trumpet',
  Trombón: 'trombone',
  Tuba: 'tuba',
  Percusión: 'percussion',
  Piano: 'piano',
  Soprano: 'soprano',
  Contralto: 'alto',
  Tenor: 'tenor',
  Bajo: 'bass',
}

export async function POST(req: NextRequest) {
  let createdWorkId: string | null = null
  let uploadedFilePath: string | null = null
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

    // 2. Garantizar perfil de usuario en public.profiles (previene violación FK works_owner_id_fkey)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        preferred_language: 'es',
        is_platform_admin: false,
      })
    }

    // 3. Extraer y validar FormData
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = ((formData.get('title') as string) || '').trim()
    const composer = ((formData.get('composer') as string) || '').trim()
    const catalogRef = ((formData.get('catalogRef') as string) || '').trim()
    const keySignature = ((formData.get('keySignature') as string) || 'C major').trim()
    const timeSignature = ((formData.get('timeSignature') as string) || '4/4').trim()
    const tempo = Math.min(320, Math.max(30, Number(formData.get('tempo')) || 120))
    const totalMeasures = Math.max(1, Number(formData.get('totalMeasures')) || 32)
    const rawSystems = formData.get('systems') as string | null

    if (!file || typeof file === 'string' || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: 'Por favor selecciona un archivo de partitura válido.' },
        { status: 400 }
      )
    }

    if (!title || !composer) {
      return NextResponse.json(
        { ok: false, error: 'El título y el compositor son obligatorios.' },
        { status: 400 }
      )
    }

    let systems: Array<{
      id?: string
      measureStart: number
      measureCount: number
      instrument: string
      bboxX: number
      bboxY: number
      bboxW: number
      bboxH: number
    }> = []

    if (rawSystems) {
      try {
        systems = JSON.parse(rawSystems)
      } catch {
        // En caso de parse error, sistemas por defecto
        systems = []
      }
    }

    if (systems.length === 0) {
      systems = [
        {
          measureStart: 1,
          measureCount: totalMeasures,
          instrument: 'Todos',
          bboxX: 0.04,
          bboxY: 0.14,
          bboxW: 0.94,
          bboxH: 0.17,
        },
      ]
    }

    // 4. Validar cuota del plan gratuito
    const { count: scoreCount } = await supabase
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)

    if ((scoreCount ?? 0) >= FREE_SCORE_LIMIT) {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('owner_user_id', user.id)
        .in('status', ['active', 'trialing'])

      const hasPaidPlan = (subs ?? []).some(
        (s) => !s.current_period_end || Date.parse(s.current_period_end) > Date.now()
      )

      if (!hasPaidPlan) {
        return NextResponse.json(
          {
            ok: false,
            error: `El plan gratuito permite hasta ${FREE_SCORE_LIMIT} partituras. Elimina una obra existente o actualiza tu plan para subir más.`,
          },
          { status: 403 }
        )
      }
    }

    // 5. Subir archivo a Supabase Storage (bucket scores)
    const rawExtension = (file.name.split('.').pop() || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const isPdf = file.type === 'application/pdf' || rawExtension === 'pdf'
    const extension = rawExtension || (isPdf ? 'pdf' : 'png')
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
        contentType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Error en el almacenamiento: ${uploadError.message}`)
    }

    // 6. Registrar en Base de Datos: works -> work_versions -> scores -> score_pages -> score_systems
    const { data: work, error: workError } = await supabase
      .from('works')
      .insert({
        owner_id: user.id,
        title,
        composer,
        catalog_reference: catalogRef || null,
        key_signature: keySignature,
        time_signature: timeSignature,
        default_tempo_bpm: tempo,
        total_measures: totalMeasures,
      })
      .select('id')
      .single()

    if (workError || !work) {
      throw new Error(workError?.message || 'No se pudo crear la obra.')
    }
    createdWorkId = work.id

    const { data: version, error: versionError } = await supabase
      .from('work_versions')
      .insert({
        work_id: work.id,
        version_name: 'Original',
        tempo_bpm_override: tempo,
        total_measures_override: totalMeasures,
      })
      .select('id')
      .single()

    if (versionError || !version) {
      throw new Error(versionError?.message || 'No se pudo crear la versión.')
    }

    const { data: score, error: scoreError } = await supabase
      .from('scores')
      .insert({
        work_version_id: version.id,
        owner_id: user.id,
        file_path: uploadedFilePath,
        file_type: isPdf ? 'pdf' : 'image',
        page_count: 1,
        status: 'ready',
        omr_engine: 'manual',
      })
      .select('id')
      .single()

    if (scoreError || !score) {
      throw new Error(scoreError?.message || 'No se pudo registrar la partitura.')
    }

    const { data: page, error: pageError } = await supabase
      .from('score_pages')
      .insert({
        score_id: score.id,
        page_number: 1,
        image_path: uploadedFilePath,
      })
      .select('id')
      .single()

    if (pageError || !page) {
      throw new Error(pageError?.message || 'No se pudo registrar la página de la partitura.')
    }

    // Mapear catálogo de instrumentos
    const instrumentById = new Map<string, string>()
    const { data: instruments } = await supabase.from('instruments').select('id, code')
    for (const inst of instruments ?? []) {
      instrumentById.set(inst.code, inst.id)
    }

    const systemsRows = systems.map((sys, idx) => {
      const code = INSTRUMENT_LABEL_TO_CODE[sys.instrument]
      const instId = code ? instrumentById.get(code) ?? null : null
      return {
        score_page_id: page.id,
        instrument_id: instId,
        system_order: idx + 1,
        measure_start: sys.measureStart,
        measure_count: sys.measureCount,
        bbox_x: sys.bboxX,
        bbox_y: sys.bboxY,
        bbox_w: sys.bboxW,
        bbox_h: sys.bboxH,
        is_manually_corrected: true,
      }
    })

    const { error: systemsError } = await supabase.from('score_systems').insert(systemsRows)
    if (systemsError) {
      throw new Error(systemsError.message || 'No se pudieron registrar los pentagramas.')
    }

    return NextResponse.json({
      ok: true,
      workId: work.id,
      versionId: version.id,
      message: 'Partitura guardada con éxito.',
    })
  } catch (err: any) {
    // Limpieza atómica de fallo
    if (createdWorkId) {
      try {
        await supabase.from('works').delete().eq('id', createdWorkId)
      } catch {
        /* best effort */
      }
    }
    if (uploadedFilePath) {
      try {
        await supabase.storage.from('scores').remove([uploadedFilePath])
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
