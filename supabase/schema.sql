-- =====================================================================
-- MODELO DE DATOS — App de Lectura Sincronizada de Partituras
-- Motor: PostgreSQL (Supabase)
-- =====================================================================
-- Convenciones:
--  - Todas las PK son uuid (default gen_random_uuid()).
--  - Todas las tablas tienen created_at / updated_at (trigger genérico al final).
--  - RLS (Row Level Security) habilitado en todas las tablas con datos de usuario.
--  - auth.users es la tabla nativa de Supabase Auth; "profiles" la extiende 1:1.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. PERFILES Y CATÁLOGOS BASE
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_language text not null default 'es',      -- es, en, zh, hi, fr, ar, pt, bn, ru, ja, de
  default_instrument_id uuid,                          -- FK diferida abajo (instruments)
  is_platform_admin boolean not null default false,    -- true solo para tu panel de admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,        -- 'violin_1', 'trumpet', 'flute', etc. (clave i18n)
  family text,                      -- 'cuerda', 'viento_madera', 'viento_metal', 'percusion', 'voz'
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint fk_profiles_default_instrument
  foreign key (default_instrument_id) references public.instruments(id) on delete set null;

-- =====================================================================
-- 2. OBRAS, VERSIONES Y PARTITURAS (archivo subido)
-- =====================================================================

create table public.works (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  composer text,
  catalog_reference text,           -- BWV, K., Op., etc.
  genre text,
  key_signature text,               -- ej. "C major", "A minor"
  time_signature text,              -- ej. "4/4", "3/4"
  default_tempo_bpm int,
  total_measures int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_works_owner on public.works(owner_id);
create index idx_works_title on public.works using gin (to_tsvector('simple', title));
create index idx_works_composer on public.works using gin (to_tsvector('simple', coalesce(composer, '')));

-- Control de versiones de una misma obra (distintos arreglos/ediciones)
create table public.work_versions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  version_name text not null,       -- ej. "Arreglo para cuarteto de cuerdas"
  tempo_bpm_override int,           -- si difiere del default de la obra
  total_measures_override int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_work_versions_work on public.work_versions(work_id);

-- El archivo físico subido (PDF o imagen) para una versión de la obra
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  work_version_id uuid not null references public.work_versions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,          -- path en Supabase Storage (bucket privado)
  file_type text not null check (file_type in ('pdf', 'image')),
  page_count int not null default 1,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing_omr', 'ready', 'error')),
  omr_engine text,                  -- 'oemer', 'audiveris', 'halbestunde', 'manual'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scores_work_version on public.scores(work_version_id);
create index idx_scores_owner on public.scores(owner_id);

-- Cada página del PDF/imagen, renderizada para mostrar en pantalla
create table public.score_pages (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  page_number int not null,
  image_path text not null,         -- render de la página como imagen (para overlay de highlight)
  width_px int,
  height_px int,
  unique (score_id, page_number)
);

create index idx_score_pages_score on public.score_pages(score_id);

-- Cada pentagrama/sistema detectado (por OMR o marcado manual) dentro de una página
create table public.score_systems (
  id uuid primary key default gen_random_uuid(),
  score_page_id uuid not null references public.score_pages(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  system_order int not null,        -- orden vertical dentro de la página
  measure_start int not null,       -- número de compás donde inicia este pentagrama
  measure_count int not null,       -- cantidad de compases que contiene
  bbox_x numeric, bbox_y numeric, bbox_w numeric, bbox_h numeric, -- coordenadas normalizadas (0-1) para el highlight
  is_manually_corrected boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_score_systems_page on public.score_systems(score_page_id);
create index idx_score_systems_instrument on public.score_systems(instrument_id);

-- Registro de cada corrida de OMR (para auditoría/depuración, no crítico para runtime)
create table public.omr_jobs (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  engine text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  raw_output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_omr_jobs_score on public.omr_jobs(score_id);

-- =====================================================================
-- 3. SESIONES DE EJECUCIÓN (Director / Ejecutantes) — efímeras
-- =====================================================================

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,          -- código corto para unirse (ej. "MZ7K-2Q")
  work_version_id uuid not null references public.work_versions(id) on delete cascade,
  director_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'paused', 'stopped', 'ended')),
  tempo_bpm int not null,
  current_measure int not null default 1,
  playback_started_at timestamptz,         -- referencia para cálculo de drift en clientes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessions_room_code on public.sessions(room_code);
create index idx_sessions_director on public.sessions(director_user_id);

-- Participantes activos/históricos de una sesión
create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  role text not null default 'performer' check (role in ('director', 'performer')),
  is_active boolean not null default true,   -- false cuando se desconecta
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_id, user_id)
);

create index idx_session_participants_session on public.session_participants(session_id);
create index idx_session_participants_user on public.session_participants(user_id);

-- =====================================================================
-- 4. ORGANIZACIONES (plan orquestal con asientos fijos) Y SUSCRIPCIONES
-- =====================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  seats_limit int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_org_members_org on public.organization_members(organization_id);

-- Catálogo de planes (sincronizado con precios de Stripe)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- 'free', 'individual_monthly', 'org_10_annual', etc.
  plan_type text not null check (plan_type in ('individual', 'organization')),
  seats_included int not null default 1,
  stripe_price_id text,
  billing_interval text check (billing_interval in ('month', 'year', null)),
  is_active boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id),
  owner_user_id uuid references public.profiles(id) on delete cascade,        -- si es plan individual
  organization_id uuid references public.organizations(id) on delete cascade, -- si es plan organizacional
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_user_id is not null and organization_id is null) or
    (owner_user_id is null and organization_id is not null)
  )
);

create index idx_subscriptions_owner on public.subscriptions(owner_user_id);
create index idx_subscriptions_org on public.subscriptions(organization_id);

-- =====================================================================
-- 5. PANEL DE ADMINISTRACIÓN (notificaciones y moderación)
-- =====================================================================

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,                 -- 'new_user', 'new_subscription', 'cancellation', etc.
  payload jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('suspend_user','reinstate_user','remove_score','warn_user')),
  target_type text not null check (target_type in ('user','score')),
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column is_suspended boolean not null default false;

-- =====================================================================
-- 6. TRIGGER GENÉRICO updated_at
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','works','work_versions','scores','sessions',
    'organizations','subscriptions'
  ]
  loop
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- =====================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.works enable row level security;
alter table public.work_versions enable row level security;
alter table public.scores enable row level security;
alter table public.score_pages enable row level security;
alter table public.score_systems enable row level security;
alter table public.omr_jobs enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.moderation_actions enable row level security;

-- Catálogos: legibles por todos, escribibles solo por backend (service role)
create policy "instruments_select_all" on public.instruments
  for select using (true);
create policy "plans_select_all" on public.plans
  for select using (true);

-- Helper: ¿el usuario actual es admin de plataforma?
-- SECURITY DEFINER: evita la recursión infinita (42P17) de invocar una función
-- que consulta `profiles` desde una política sobre la propia tabla `profiles`.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- --- profiles: cada usuario ve/edita solo su propio perfil; admin ve todos ---
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());

-- El UPDATE del propio perfil está limitado a columnas seguras vía GRANT (ver §9).
-- `is_platform_admin` / `is_suspended` solo cambian desde el backend o por admin,
-- reforzado por el trigger trg_profiles_protect_privileges (§8).
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_admin_update" on public.profiles
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

-- --- works / work_versions / scores / score_pages / score_systems: privado por dueño ---
create policy "works_owner_all" on public.works
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "work_versions_owner_all" on public.work_versions
  for all using (
    exists (select 1 from public.works w where w.id = work_id and w.owner_id = auth.uid())
  );

create policy "scores_owner_all" on public.scores
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "score_pages_owner_all" on public.score_pages
  for all using (
    exists (select 1 from public.scores s where s.id = score_id and s.owner_id = auth.uid())
  );

create policy "score_systems_owner_all" on public.score_systems
  for all using (
    exists (
      select 1 from public.score_pages sp
      join public.scores s on s.id = sp.score_id
      where sp.id = score_page_id and s.owner_id = auth.uid()
    )
  );

create policy "omr_jobs_owner_select" on public.omr_jobs
  for select using (
    exists (select 1 from public.scores s where s.id = score_id and s.owner_id = auth.uid())
  );

-- --- sessions: visibles para el director y para cualquier participante activo ---
create policy "sessions_director_all" on public.sessions
  for all using (director_user_id = auth.uid())
  with check (director_user_id = auth.uid());

create policy "sessions_participant_select" on public.sessions
  for select using (
    exists (
      select 1 from public.session_participants sp
      where sp.session_id = id and sp.user_id = auth.uid()
    )
  );

-- Panel de admin: lectura de métricas (escritura solo vía Server Actions/service role)
create policy "sessions_admin_select" on public.sessions
  for select using (public.is_platform_admin());

-- El lookup público por room_code se hace con la RPC security definer
-- `join_session(p_room_code)` (§7), no con un SELECT abierto sobre la tabla.

create policy "session_participants_self_select" on public.session_participants
  for select using (user_id = auth.uid());

create policy "session_participants_self_insert" on public.session_participants
  for insert with check (user_id = auth.uid() and role = 'performer');

-- Solo columnas is_active / left_at son editables desde el cliente (ver GRANTs §9):
-- la columna `role` no puede auto-asignarse (evita escalarse a 'director').
create policy "session_participants_self_update" on public.session_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "session_participants_director_select" on public.session_participants
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.director_user_id = auth.uid()
    )
  );

-- --- participantes de la sesión: pueden leer la partitura en uso ---
create policy "works_session_participant_select" on public.works
  for select using (
    exists (
      select 1 from public.work_versions wv
      join public.sessions s on s.work_version_id = wv.id
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where wv.work_id = works.id
    )
  );

create policy "work_versions_session_participant_select" on public.work_versions
  for select using (
    exists (
      select 1 from public.sessions s
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where s.work_version_id = work_versions.id
    )
  );

create policy "scores_session_participant_select" on public.scores
  for select using (
    exists (
      select 1 from public.sessions s
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where s.work_version_id = scores.work_version_id
    )
  );

create policy "scores_admin_select" on public.scores
  for select using (public.is_platform_admin());

create policy "score_pages_session_participant_select" on public.score_pages
  for select using (
    exists (
      select 1 from public.scores sc
      join public.sessions s on s.work_version_id = sc.work_version_id
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where sc.id = score_pages.score_id
    )
  );

create policy "score_systems_session_participant_select" on public.score_systems
  for select using (
    exists (
      select 1 from public.score_pages spg
      join public.scores sc on sc.id = spg.score_id
      join public.sessions s on s.work_version_id = sc.work_version_id
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where spg.id = score_systems.score_page_id
    )
  );

-- --- organizations / members ---
create policy "organizations_owner_all" on public.organizations
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "organizations_member_select" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = id and m.user_id = auth.uid()
    )
  );

create policy "organization_members_owner_all" on public.organization_members
  for all using (
    exists (
      select 1 from public.organizations o
      where o.id = organization_id and o.owner_user_id = auth.uid()
    )
  );

create policy "organization_members_self_select" on public.organization_members
  for select using (user_id = auth.uid());

-- --- subscriptions: el propio usuario o dueño de la organización ---
create policy "subscriptions_individual_owner" on public.subscriptions
  for select using (owner_user_id = auth.uid());

create policy "subscriptions_org_owner" on public.subscriptions
  for select using (
    exists (
      select 1 from public.organizations o
      where o.id = organization_id and o.owner_user_id = auth.uid()
    )
  );

-- Nota: INSERT/UPDATE de subscriptions se hace exclusivamente desde el backend
-- (webhook de Stripe con service_role key), nunca directo desde el cliente.

-- --- admin_notifications / moderation_actions: solo platform admin ---
create policy "admin_notifications_admin_only" on public.admin_notifications
  for all using (public.is_platform_admin());

create policy "moderation_actions_admin_only" on public.moderation_actions
  for all using (public.is_platform_admin());

-- =====================================================================
-- 8. TRIGGERS DE ONBOARDING Y PROTECCIÓN DE PRIVILEGIOS
-- =====================================================================

-- 8.1 Crea el perfil automáticamente al registrarse un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: perfiles faltantes de usuarios creados antes de este trigger
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 8.2 Nadie se auto-promote a admin ni se auto-suspende (defensa en profundidad)
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Backend (service role) opera sin auth.uid(): se permite.
  if auth.uid() is null then
    return new;
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin
     or new.is_suspended is distinct from old.is_suspended then
    if not public.is_platform_admin() then
      raise exception 'privileged_profile_fields_are_readonly';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- =====================================================================
-- 9. RPCs (SECURITY DEFINER) — único camino de escritura sobre sesiones
-- =====================================================================

-- 9.1 Crear sala: genera room_code único (ej. "MZ7K-2Q") y registra al director
create or replace function public.create_session(p_work_version_id uuid, p_tempo_bpm int default 100)
returns public.sessions
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_session public.sessions;
  v_attempts int := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  if exists (select 1 from public.profiles where id = auth.uid() and is_suspended) then
    raise exception 'account_suspended';
  end if;

  if not exists (
    select 1
    from public.work_versions wv
    join public.works w on w.id = wv.work_id
    where wv.id = p_work_version_id and w.owner_id = auth.uid()
  ) then
    raise exception 'not_score_owner';
  end if;

  loop
    v_code := upper(substr(md5(random()::text), 1, 4))
           || '-'
           || upper(substr(md5(random()::text), 5, 2));
    exit when not exists (select 1 from public.sessions where room_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then raise exception 'room_code_generation_failed'; end if;
  end loop;

  insert into public.sessions (room_code, work_version_id, director_user_id, status, tempo_bpm, current_measure)
  values (v_code, p_work_version_id, auth.uid(), 'waiting', greatest(1, least(300, coalesce(p_tempo_bpm, 100))), 1)
  returning * into v_session;

  insert into public.session_participants (session_id, user_id, role, is_active)
  values (v_session.id, auth.uid(), 'director', true);

  return v_session;
end;
$$;

-- 9.2 Unirse por room_code: devuelve la sesión e inserta al participante
create or replace function public.join_session(p_room_code text)
returns public.sessions
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  if exists (select 1 from public.profiles where id = auth.uid() and is_suspended) then
    raise exception 'account_suspended';
  end if;

  select * into v_session
  from public.sessions
  where room_code = upper(trim(p_room_code));

  if not found then raise exception 'session_not_found'; end if;

  insert into public.session_participants (session_id, user_id, role, is_active)
  values (v_session.id, auth.uid(), 'performer', true)
  on conflict (session_id, user_id)
  do update set is_active = true, left_at = null;

  return v_session;
end;
$$;

-- 9.3 Transferir la dirección de la sesión (solo el director actual)
create or replace function public.transfer_director(p_session_id uuid, p_new_director_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_current_director uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select director_user_id into v_current_director
  from public.sessions where id = p_session_id;

  if v_current_director is null then raise exception 'session_not_found'; end if;
  if v_current_director <> auth.uid() then raise exception 'only_current_director_can_transfer'; end if;
  if p_new_director_id = auth.uid() then raise exception 'target_is_current_director'; end if;

  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = p_new_director_id
  ) then
    raise exception 'target_user_is_not_a_participant';
  end if;

  update public.sessions
  set director_user_id = p_new_director_id
  where id = p_session_id;

  update public.session_participants
  set role = 'director'
  where session_id = p_session_id and user_id = p_new_director_id;

  update public.session_participants
  set role = 'performer', is_active = true, left_at = null
  where session_id = p_session_id and user_id = v_current_director;
end;
$$;

-- 9.4 Salir de la sesión (marcar como inactivo sin borrar el historial)
create or replace function public.leave_session(p_session_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  update public.session_participants
  set is_active = false, left_at = now()
  where session_id = p_session_id and user_id = auth.uid();
end;
$$;

revoke all on function public.create_session(uuid, int) from public, anon;
revoke all on function public.join_session(text) from public, anon;
revoke all on function public.transfer_director(uuid, uuid) from public, anon;
revoke all on function public.leave_session(uuid) from public, anon;
grant execute on function public.create_session(uuid, int) to authenticated;
grant execute on function public.join_session(text) to authenticated;
grant execute on function public.transfer_director(uuid, uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;

-- =====================================================================
-- 10. GRANTs POR COLUMNA (bloquean la auto-edición de campos sensibles)
-- =====================================================================

-- profiles: el cliente solo puede tocar sus datos personales
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, preferred_language, default_instrument_id)
  on public.profiles to authenticated;

-- session_participants: el cliente no puede alterar role / sesión / usuario
revoke update on public.session_participants from anon, authenticated;
grant update (is_active, left_at) on public.session_participants to authenticated;

-- catálogos: solo lectura desde el cliente
revoke insert, update, delete on public.instruments from anon, authenticated;
revoke insert, update, delete on public.plans from anon, authenticated;

-- =====================================================================
-- 11. REALTIME Y SEEDS
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.admin_notifications;
    alter publication supabase_realtime add table public.sessions;
  end if;
exception
  when duplicate_object then null;   -- ya publicada
end $$;

insert into public.instruments (code, family) values
  ('violin_1', 'cuerda'), ('violin_2', 'cuerda'), ('viola', 'cuerda'),
  ('cello', 'cuerda'), ('contrabass', 'cuerda'),
  ('flute', 'viento_madera'), ('oboe', 'viento_madera'),
  ('clarinet', 'viento_madera'), ('bassoon', 'viento_madera'),
  ('horn', 'viento_metal'), ('trumpet', 'viento_metal'),
  ('trombone', 'viento_metal'), ('tuba', 'viento_metal'),
  ('percussion', 'percusion'), ('piano', 'teclado'),
  ('soprano', 'voz'), ('alto', 'voz'), ('tenor', 'voz'), ('bass', 'voz')
on conflict (code) do nothing;

insert into public.plans (code, plan_type, seats_included, billing_interval, is_active) values
  ('free', 'individual', 1, null, true),
  ('individual_monthly', 'individual', 1, 'month', true),
  ('org_annual', 'organization', 10, 'year', true)
on conflict (code) do nothing;

-- =====================================================================
-- FIN DEL ESQUEMA BASE
-- =====================================================================
