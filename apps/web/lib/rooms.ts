import type { createBrowserClient } from '@music-flow/supabase'

type BrowserClient = ReturnType<typeof createBrowserClient>

export type RoomCreateResult =
  | { ok: true; roomCode: string }
  | { ok: false; kind: 'auth' | 'no_works' | 'error'; message: string }

/** Última versión (arreglo/edición) registrada para una obra. */
export async function fetchLatestVersion(
  supabase: BrowserClient,
  workId: string
): Promise<{ id: string; tempo_bpm_override: number | null } | null> {
  const { data } = await supabase
    .from('work_versions')
    .select('id, tempo_bpm_override')
    .eq('work_id', workId)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

/** Versión más reciente del usuario (para "Crear Sala Inmediata"). */
export async function fetchAnyOwnedVersion(
  supabase: BrowserClient
): Promise<{ workId: string; versionId: string; tempo: number | null } | null> {
  const { data: works } = await supabase
    .from('works')
    .select('id, default_tempo_bpm')
    .order('created_at', { ascending: false })
    .limit(1)
  const work = works?.[0]
  if (!work) return null

  const version = await fetchLatestVersion(supabase, work.id)
  if (!version) return null

  return {
    workId: work.id,
    versionId: version.id,
    tempo: version.tempo_bpm_override ?? work.default_tempo_bpm ?? null,
  }
}

/**
 * Crea una sala real vía la RPC security definer `create_session` y devuelve
 * el room_code generado (ej. "MZ7K-2Q"). Nunca genera códigos en el cliente.
 */
export async function createRoomForVersion(
  supabase: BrowserClient,
  versionId: string,
  fallbackTempo?: number | null
): Promise<RoomCreateResult> {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return { ok: false, kind: 'auth', message: 'Inicia sesión para crear una sala de ensayo.' }
  }

  // 1) Intentar primero vía RPC nativa si está instalada en Postgres
  try {
    const { data, error } = await supabase.rpc('create_session', {
      p_work_version_id: versionId,
      ...(fallbackTempo ? { p_tempo_bpm: Math.min(300, Math.max(1, Math.round(fallbackTempo))) } : {}),
    })

    if (!error && data?.room_code) {
      return { ok: true, roomCode: data.room_code }
    }
  } catch {
    /* fallback a ruta de servidor */
  }

  // 2) Fallback robusto vía endpoint de servidor Next.js
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      return { ok: false, kind: 'auth', message: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    }

    const res = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workVersionId: versionId,
        tempoBpm: fallbackTempo,
      }),
    })

    const json = await res.json()
    if (!res.ok || !json.ok || !json.session?.room_code) {
      return { ok: false, kind: 'error', message: json.error || 'No se pudo crear la sala.' }
    }

    return { ok: true, roomCode: json.session.room_code }
  } catch (e: any) {
    return { ok: false, kind: 'error', message: e?.message || 'No se pudo crear la sala.' }
  }
}

