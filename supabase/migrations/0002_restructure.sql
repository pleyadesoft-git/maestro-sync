-- =====================================================================
-- MIGRACIÓN 0002 — Reestructuración MaestroSync
--   · Modelo sistema → pentagramas → compases (score_staves, score_measures)
--   · Partes / particellas (parts, scores.part_id)
--   · Mapa de reproducción con repeticiones (work_versions.playback_map)
--   · Ensambles (bandas / orquestas), roles y asignación de atriles
--   · Planes nuevos: prueba 15 días, individual, banda, orquesta (+ anual -15 %)
--   · Búsqueda full-text sin acentos (works.search_vector)
-- Requiere: schema.sql + 0001_security_fixes.sql
-- Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- Envoltura IMMUTABLE de unaccent (necesaria para columnas generadas e índices)
create or replace function public.f_unaccent(text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions, pg_temp
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------------------
-- 1. Perfiles: prueba gratuita de 15 días
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '15 days');

-- ---------------------------------------------------------------------
-- 2. Catálogo de instrumentos ampliado (bandas y orquestas)
-- ---------------------------------------------------------------------
insert into public.instruments (code, family) values
  ('piccolo', 'viento_madera'), ('english_horn', 'viento_madera'),
  ('bass_clarinet', 'viento_madera'), ('contrabassoon', 'viento_madera'),
  ('soprano_sax', 'viento_madera'), ('alto_sax', 'viento_madera'),
  ('tenor_sax', 'viento_madera'), ('baritone_sax', 'viento_madera'),
  ('cornet', 'viento_metal'), ('euphonium', 'viento_metal'),
  ('timpani', 'percusion'), ('drum_set', 'percusion'),
  ('glockenspiel', 'percusion'), ('xylophone', 'percusion'), ('marimba', 'percusion'),
  ('harp', 'cuerda'), ('guitar', 'cuerda'), ('electric_bass', 'cuerda'),
  ('organ', 'teclado'), ('celesta', 'teclado'),
  ('voice', 'voz')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 3. Ensambles (amplía organizations) y miembros con rol
-- ---------------------------------------------------------------------
alter table public.organizations
  add column if not exists ensemble_type text not null default 'orchestra',
  add column if not exists max_members int,
  add column if not exists invite_code text;

do $$ begin
  alter table public.organizations
    add constraint organizations_ensemble_type_check check (ensemble_type in ('band', 'orchestra'));
exception when duplicate_object then null; end $$;

create unique index if not exists idx_organizations_invite_code
  on public.organizations(invite_code) where invite_code is not null;

alter table public.organization_members
  add column if not exists role text not null default 'musician',
  add column if not exists instrument_id uuid references public.instruments(id) on delete set null;

do $$ begin
  alter table public.organization_members
    add constraint organization_members_role_check check (role in ('director', 'musician', 'librarian'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 4. Obras compartidas con un ensamble + búsqueda sin acentos
-- ---------------------------------------------------------------------
alter table public.works
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_works_organization on public.works(organization_id);

do $$ begin
  alter table public.works add column search_vector tsvector
    generated always as (
      to_tsvector('simple', public.f_unaccent(
        coalesce(title, '') || ' ' || coalesce(composer, '') || ' ' ||
        coalesce(catalog_reference, '') || ' ' || coalesce(genre, '') || ' ' ||
        coalesce(key_signature, '')
      ))
    ) stored;
exception when duplicate_column then null; end $$;

create index if not exists idx_works_search_vector on public.works using gin (search_vector);

-- ---------------------------------------------------------------------
-- 5. Versiones: mapa de reproducción (repeticiones, D.C., D.S., casillas)
--    Formato: [{ "at": 16, "to": 1, "times": 1, "label": "repeat" }, ...]
--    Al llegar al FINAL del compás "at", saltar a "to" (las veces indicadas).
-- ---------------------------------------------------------------------
alter table public.work_versions
  add column if not exists playback_map jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 6. Partes (instrumento + atriles) por versión
-- ---------------------------------------------------------------------
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  work_version_id uuid not null references public.work_versions(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  name text not null,                 -- ej. "Violín I", "Clarinete en Sib 2"
  part_order int not null default 0,  -- orden vertical en la partitura general
  desk_count int not null default 1,  -- número de atriles de esta parte
  created_at timestamptz not null default now(),
  unique (work_version_id, name)
);

create index if not exists idx_parts_version on public.parts(work_version_id);

-- ---------------------------------------------------------------------
-- 7. Scores: particellas, MusicXML y estado de revisión
-- ---------------------------------------------------------------------
alter table public.scores
  add column if not exists part_id uuid references public.parts(id) on delete set null,
  add column if not exists analysis jsonb;

alter table public.scores drop constraint if exists scores_file_type_check;
alter table public.scores add constraint scores_file_type_check
  check (file_type in ('pdf', 'image', 'musicxml'));

alter table public.scores drop constraint if exists scores_status_check;
alter table public.scores add constraint scores_status_check
  check (status in ('uploaded', 'processing_omr', 'needs_review', 'ready', 'error'));

-- ---------------------------------------------------------------------
-- 8. Sistemas → pentagramas → compases
-- ---------------------------------------------------------------------
alter table public.score_systems
  add column if not exists confidence numeric,
  add column if not exists detection_source text not null default 'manual';

do $$ begin
  alter table public.score_systems
    add constraint score_systems_detection_source_check
    check (detection_source in ('auto', 'manual', 'musicxml'));
exception when duplicate_object then null; end $$;

create table if not exists public.score_staves (
  id uuid primary key default gen_random_uuid(),
  score_system_id uuid not null references public.score_systems(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  staff_order int not null,
  bbox_x numeric not null, bbox_y numeric not null,
  bbox_w numeric not null, bbox_h numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_score_staves_system on public.score_staves(score_system_id);
create index if not exists idx_score_staves_part on public.score_staves(part_id);

create table if not exists public.score_measures (
  id uuid primary key default gen_random_uuid(),
  score_system_id uuid not null references public.score_systems(id) on delete cascade,
  measure_number int not null,
  x_start numeric not null,           -- normalizado 0-1 respecto al ancho de la página
  x_end numeric not null,
  unique (score_system_id, measure_number)
);

create index if not exists idx_score_measures_system on public.score_measures(score_system_id);

-- ---------------------------------------------------------------------
-- 9. Asignación de atriles (la decide el director del ensamble)
-- ---------------------------------------------------------------------
create table if not exists public.stand_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_version_id uuid not null references public.work_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  desk_number int not null default 1,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, work_version_id, user_id)
);

create index if not exists idx_stand_assignments_version on public.stand_assignments(work_version_id);

drop trigger if exists trg_stand_assignments_updated_at on public.stand_assignments;
create trigger trg_stand_assignments_updated_at before update on public.stand_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Sesiones: ensamble, modo de sincronía, conteo previo, parte elegida
-- ---------------------------------------------------------------------
alter table public.sessions
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists sync_mode text not null default 'metronome',
  add column if not exists count_in_measures int not null default 1,
  add column if not exists allow_part_selection boolean not null default true;

do $$ begin
  alter table public.sessions
    add constraint sessions_sync_mode_check check (sync_mode in ('metronome', 'manual'));
exception when duplicate_object then null; end $$;

alter table public.session_participants
  add column if not exists part_id uuid references public.parts(id) on delete set null;

-- ---------------------------------------------------------------------
-- 11. Planes y suscripciones
-- ---------------------------------------------------------------------
alter table public.plans
  add column if not exists name text,
  add column if not exists ensemble_type text,
  add column if not exists price_cents int not null default 0,
  add column if not exists seat_price_cents int not null default 0,
  add column if not exists stripe_seat_price_id text,
  add column if not exists max_members int,
  add column if not exists trial_days int;

alter table public.subscriptions
  add column if not exists seat_quantity int not null default 0,
  add column if not exists stripe_seat_item_id text;

update public.plans set is_active = false where code = 'org_annual';

insert into public.plans (code, name, plan_type, ensemble_type, seats_included, billing_interval,
                          price_cents, seat_price_cents, max_members, trial_days, is_active) values
  ('free',               'Prueba gratuita (15 días)',   'individual',   null,       1, null,     0,     0,    null, 15, true),
  ('individual_monthly', 'Músico independiente',        'individual',   null,       1, 'month',  800,   0,    null, null, true),
  ('individual_annual',  'Músico independiente anual',  'individual',   null,       1, 'year',   8160,  0,    null, null, true),
  ('band_monthly',       'Banda',                       'organization', 'band',     0, 'month',  2200,  300,  15,   null, true),
  ('band_annual',        'Banda anual',                 'organization', 'band',     0, 'year',   22440, 3060, 15,   null, true),
  ('orchestra_monthly',  'Orquesta',                    'organization', 'orchestra',0, 'month',  4500,  300,  null, null, true),
  ('orchestra_annual',   'Orquesta anual',              'organization', 'orchestra',0, 'year',   45900, 3060, null, null, true)
on conflict (code) do update set
  name = excluded.name,
  plan_type = excluded.plan_type,
  ensemble_type = excluded.ensemble_type,
  seats_included = excluded.seats_included,
  billing_interval = excluded.billing_interval,
  price_cents = excluded.price_cents,
  seat_price_cents = excluded.seat_price_cents,
  max_members = excluded.max_members,
  trial_days = excluded.trial_days,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------
-- 12. Helpers SECURITY DEFINER (evitan recursión 42P17 en políticas)
-- ---------------------------------------------------------------------

-- ¿El usuario tiene un plan propio vigente? (prueba, individual, o dueño de ensamble con plan)
create or replace function public.user_has_active_plan(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.profiles p where p.id = p_user_id and p.trial_ends_at > now())
    or exists (
      select 1 from public.subscriptions s
      where s.owner_user_id = p_user_id
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    )
    or exists (
      select 1 from public.subscriptions s
      join public.organizations o on o.id = s.organization_id
      where o.owner_user_id = p_user_id
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    );
$$;

create or replace function public.is_ensemble_member(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.organizations o where o.id = p_org_id and o.owner_user_id = auth.uid())
      or exists (select 1 from public.organization_members m where m.organization_id = p_org_id and m.user_id = auth.uid());
$$;

create or replace function public.is_ensemble_director(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.organizations o where o.id = p_org_id and o.owner_user_id = auth.uid())
      or exists (
        select 1 from public.organization_members m
        where m.organization_id = p_org_id and m.user_id = auth.uid() and m.role in ('director', 'librarian')
      );
$$;

create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.session_participants sp
    where sp.session_id = p_session_id and sp.user_id = auth.uid()
  );
$$;

-- ¿El usuario puede leer esta versión? (dueño, participante de sesión o miembro del ensamble)
create or replace function public.can_read_work_version(p_version_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.work_versions wv
    join public.works w on w.id = wv.work_id
    where wv.id = p_version_id
      and (
        w.owner_id = auth.uid()
        or (w.organization_id is not null and public.is_ensemble_member(w.organization_id))
        or exists (
          select 1 from public.sessions s
          join public.session_participants sp on sp.session_id = s.id and sp.user_id = auth.uid()
          where s.work_version_id = wv.id
        )
      )
  );
$$;

create or replace function public.can_edit_work_version(p_version_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.work_versions wv
    join public.works w on w.id = wv.work_id
    where wv.id = p_version_id
      and (
        w.owner_id = auth.uid()
        or (w.organization_id is not null and public.is_ensemble_director(w.organization_id))
      )
  );
$$;

-- Músicos facturables ($3) = miembros sin plan propio vigente (el dueño nunca se cobra)
create or replace function public.ensemble_billable_seats(p_org_id uuid)
returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_org_id
    and m.user_id <> o.owner_user_id
    and not public.user_has_active_plan(m.user_id);
$$;

-- Límite de 15 músicos por banda
create or replace function public.enforce_ensemble_member_limit()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_max int;
  v_count int;
begin
  select coalesce(o.max_members, case when o.ensemble_type = 'band' then 15 end)
    into v_max
  from public.organizations o where o.id = new.organization_id;

  if v_max is null then return new; end if;

  select count(*) into v_count
  from public.organization_members m
  where m.organization_id = new.organization_id and m.role <> 'director';

  if new.role <> 'director' and v_count >= v_max then
    raise exception 'ensemble_member_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_organization_members_limit on public.organization_members;
create trigger trg_organization_members_limit
  before insert on public.organization_members
  for each row execute function public.enforce_ensemble_member_limit();

-- Unirse a un ensamble con el código de invitación
create or replace function public.join_ensemble(p_invite_code text)
returns public.organizations
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_org from public.organizations
  where invite_code = upper(trim(p_invite_code));
  if not found then raise exception 'ensemble_not_found'; end if;

  if v_org.owner_user_id = auth.uid() then return v_org; end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'musician')
  on conflict (organization_id, user_id) do nothing;

  return v_org;
end;
$$;

-- Restablecer el marcado detectado conservando el archivo y las páginas
create or replace function public.reset_score_markup(p_score_id uuid)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_version uuid;
begin
  select work_version_id into v_version from public.scores where id = p_score_id;
  if v_version is null then raise exception 'score_not_found'; end if;
  if not public.can_edit_work_version(v_version) then raise exception 'not_allowed'; end if;

  delete from public.score_systems
  where score_page_id in (select id from public.score_pages where score_id = p_score_id);

  update public.scores set status = 'needs_review', analysis = null where id = p_score_id;
  update public.work_versions set playback_map = '[]'::jsonb where id = v_version;
end;
$$;

revoke all on function public.join_ensemble(text) from public, anon;
revoke all on function public.reset_score_markup(uuid) from public, anon;
grant execute on function public.join_ensemble(text) to authenticated;
grant execute on function public.reset_score_markup(uuid) to authenticated;
grant execute on function public.user_has_active_plan(uuid) to authenticated;
grant execute on function public.ensemble_billable_seats(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------
alter table public.parts enable row level security;
alter table public.score_staves enable row level security;
alter table public.score_measures enable row level security;
alter table public.stand_assignments enable row level security;

-- Corrección: en schema.sql, `id` dentro de la subconsulta resolvía a la
-- columna de la tabla interna (m.id / sp.id), no a la fila externa.
drop policy if exists "organizations_member_select" on public.organizations;
create policy "organizations_member_select" on public.organizations
  for select using (public.is_ensemble_member(id));

drop policy if exists "sessions_participant_select" on public.sessions;
create policy "sessions_participant_select" on public.sessions
  for select using (public.is_session_participant(id));

-- Miembros: el director administra; los miembros ven a sus compañeros
drop policy if exists "organization_members_director_all" on public.organization_members;
create policy "organization_members_director_all" on public.organization_members
  for all using (public.is_ensemble_director(organization_id))
  with check (public.is_ensemble_director(organization_id));

drop policy if exists "organization_members_peer_select" on public.organization_members;
create policy "organization_members_peer_select" on public.organization_members
  for select using (public.is_ensemble_member(organization_id));

drop policy if exists "organization_members_self_delete" on public.organization_members;
create policy "organization_members_self_delete" on public.organization_members
  for delete using (user_id = auth.uid());

-- Obras compartidas con el ensamble
drop policy if exists "works_ensemble_select" on public.works;
create policy "works_ensemble_select" on public.works
  for select using (organization_id is not null and public.is_ensemble_member(organization_id));

drop policy if exists "works_ensemble_director_update" on public.works;
create policy "works_ensemble_director_update" on public.works
  for update using (organization_id is not null and public.is_ensemble_director(organization_id));

drop policy if exists "work_versions_shared_select" on public.work_versions;
create policy "work_versions_shared_select" on public.work_versions
  for select using (public.can_read_work_version(id));

drop policy if exists "work_versions_editor_update" on public.work_versions;
create policy "work_versions_editor_update" on public.work_versions
  for update using (public.can_edit_work_version(id));

drop policy if exists "scores_shared_select" on public.scores;
create policy "scores_shared_select" on public.scores
  for select using (public.can_read_work_version(work_version_id));

drop policy if exists "score_pages_shared_select" on public.score_pages;
create policy "score_pages_shared_select" on public.score_pages
  for select using (
    exists (select 1 from public.scores sc where sc.id = score_id and public.can_read_work_version(sc.work_version_id))
  );

drop policy if exists "score_systems_shared_select" on public.score_systems;
create policy "score_systems_shared_select" on public.score_systems
  for select using (
    exists (
      select 1 from public.score_pages sp join public.scores sc on sc.id = sp.score_id
      where sp.id = score_page_id and public.can_read_work_version(sc.work_version_id)
    )
  );

-- parts
drop policy if exists "parts_read" on public.parts;
create policy "parts_read" on public.parts
  for select using (public.can_read_work_version(work_version_id));
drop policy if exists "parts_edit" on public.parts;
create policy "parts_edit" on public.parts
  for all using (public.can_edit_work_version(work_version_id))
  with check (public.can_edit_work_version(work_version_id));

-- score_staves / score_measures (vía sistema → página → score)
drop policy if exists "score_staves_read" on public.score_staves;
create policy "score_staves_read" on public.score_staves
  for select using (
    exists (
      select 1 from public.score_systems ss
      join public.score_pages sp on sp.id = ss.score_page_id
      join public.scores sc on sc.id = sp.score_id
      where ss.id = score_system_id and public.can_read_work_version(sc.work_version_id)
    )
  );
drop policy if exists "score_staves_edit" on public.score_staves;
create policy "score_staves_edit" on public.score_staves
  for all using (
    exists (
      select 1 from public.score_systems ss
      join public.score_pages sp on sp.id = ss.score_page_id
      join public.scores sc on sc.id = sp.score_id
      where ss.id = score_system_id and public.can_edit_work_version(sc.work_version_id)
    )
  );

drop policy if exists "score_measures_read" on public.score_measures;
create policy "score_measures_read" on public.score_measures
  for select using (
    exists (
      select 1 from public.score_systems ss
      join public.score_pages sp on sp.id = ss.score_page_id
      join public.scores sc on sc.id = sp.score_id
      where ss.id = score_system_id and public.can_read_work_version(sc.work_version_id)
    )
  );
drop policy if exists "score_measures_edit" on public.score_measures;
create policy "score_measures_edit" on public.score_measures
  for all using (
    exists (
      select 1 from public.score_systems ss
      join public.score_pages sp on sp.id = ss.score_page_id
      join public.scores sc on sc.id = sp.score_id
      where ss.id = score_system_id and public.can_edit_work_version(sc.work_version_id)
    )
  );

-- stand_assignments: el director asigna; el músico ve la suya y las de su ensamble
drop policy if exists "stand_assignments_director_all" on public.stand_assignments;
create policy "stand_assignments_director_all" on public.stand_assignments
  for all using (public.is_ensemble_director(organization_id))
  with check (public.is_ensemble_director(organization_id));
drop policy if exists "stand_assignments_member_select" on public.stand_assignments;
create policy "stand_assignments_member_select" on public.stand_assignments
  for select using (public.is_ensemble_member(organization_id));

-- Storage: miembros del ensamble pueden leer los archivos de obras compartidas
drop policy if exists "scores_storage_ensemble_select" on storage.objects;
create policy "scores_storage_ensemble_select" on storage.objects
  for select using (
    bucket_id = 'scores'
    and exists (
      select 1 from public.scores sc
      where (sc.file_path = storage.objects.name
             or exists (select 1 from public.score_pages sp where sp.score_id = sc.id and sp.image_path = storage.objects.name))
        and public.can_read_work_version(sc.work_version_id)
    )
  );

-- ---------------------------------------------------------------------
-- 14. Migración de datos: score_systems.instrument_id → parts + score_staves
-- ---------------------------------------------------------------------
insert into public.parts (work_version_id, instrument_id, name, part_order)
select distinct sc.work_version_id, ss.instrument_id, i.code, 0
from public.score_systems ss
join public.score_pages sp on sp.id = ss.score_page_id
join public.scores sc on sc.id = sp.score_id
join public.instruments i on i.id = ss.instrument_id
where ss.instrument_id is not null
on conflict (work_version_id, name) do nothing;

insert into public.score_staves (score_system_id, part_id, staff_order, bbox_x, bbox_y, bbox_w, bbox_h)
select ss.id, p.id, 1,
       coalesce(ss.bbox_x, 0.04), coalesce(ss.bbox_y, 0.1),
       coalesce(ss.bbox_w, 0.92), coalesce(ss.bbox_h, 0.15)
from public.score_systems ss
join public.score_pages sp on sp.id = ss.score_page_id
join public.scores sc on sc.id = sp.score_id
join public.instruments i on i.id = ss.instrument_id
join public.parts p on p.work_version_id = sc.work_version_id and p.name = i.code
where not exists (select 1 from public.score_staves st where st.score_system_id = ss.id);

-- ---------------------------------------------------------------------
-- 15. Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.stand_assignments;
  end if;
exception
  when duplicate_object then null;
end $$;

-- =====================================================================
-- FIN MIGRACIÓN 0002
-- =====================================================================
