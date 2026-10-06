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
  admin_id uuid not null references public.profiles(id),
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
alter table public.subscriptions enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.moderation_actions enable row level security;

-- Helper: ¿el usuario actual es admin de plataforma?
create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- --- profiles: cada usuario ve/edita solo su propio perfil; admin ve todos ---
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

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

-- Nota: la transferencia de rol de Director (sección 14.1 del plan) se resuelve
-- vía una función RPC (security definer) que valida atomically quién puede tomar
-- el control, en lugar de permitir UPDATE directo de director_user_id desde el cliente.

create policy "session_participants_self_all" on public.session_participants
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "session_participants_director_select" on public.session_participants
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.director_user_id = auth.uid()
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
-- FIN DEL ESQUEMA BASE
-- =====================================================================
