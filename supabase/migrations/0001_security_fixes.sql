-- =====================================================================
-- MIGRACIÓN 0001 — Correcciones de seguridad y funcionamiento
-- Aplicar sobre una base de datos que ya ejecutó supabase/schema.sql (versión previa).
-- Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RLS en las tablas que quedaron sin habilitar (catálogos)
-- ---------------------------------------------------------------------
alter table public.instruments enable row level security;
alter table public.plans enable row level security;

drop policy if exists "instruments_select_all" on public.instruments;
create policy "instruments_select_all" on public.instruments
  for select using (true);

drop policy if exists "plans_select_all" on public.plans;
create policy "plans_select_all" on public.plans
  for select using (true);

revoke insert, update, delete on public.instruments from anon, authenticated;
revoke insert, update, delete on public.plans from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. is_platform_admin() → SECURITY DEFINER (evita recursión 42P17)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. Bloqueo de auto-promoción en profiles
-- ---------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, preferred_language, default_instrument_id)
  on public.profiles to authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
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

drop trigger if exists trg_profiles_protect_privileges on public.profiles;
create trigger trg_profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- 4. Perfil automático al registrarse (auth.users → public.profiles)
-- ---------------------------------------------------------------------
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. Políticas de sesiones: lookup por room_code vía RPC + métricas admin
-- ---------------------------------------------------------------------
drop policy if exists "sessions_admin_select" on public.sessions;
create policy "sessions_admin_select" on public.sessions
  for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- 6. session_participants: sin auto-asignación de rol 'director'
-- ---------------------------------------------------------------------
drop policy if exists "session_participants_self_all" on public.session_participants;
drop policy if exists "session_participants_self_select" on public.session_participants;
drop policy if exists "session_participants_self_insert" on public.session_participants;
drop policy if exists "session_participants_self_update" on public.session_participants;

create policy "session_participants_self_select" on public.session_participants
  for select using (user_id = auth.uid());
create policy "session_participants_self_insert" on public.session_participants
  for insert with check (user_id = auth.uid() and role = 'performer');
create policy "session_participants_self_update" on public.session_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on public.session_participants from anon, authenticated;
grant update (is_active, left_at) on public.session_participants to authenticated;

-- ---------------------------------------------------------------------
-- 7. Lectura de la partitura en uso por parte de los participantes
-- ---------------------------------------------------------------------
drop policy if exists "works_session_participant_select" on public.works;
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

drop policy if exists "work_versions_session_participant_select" on public.work_versions;
create policy "work_versions_session_participant_select" on public.work_versions
  for select using (
    exists (
      select 1 from public.sessions s
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where s.work_version_id = work_versions.id
    )
  );

drop policy if exists "scores_session_participant_select" on public.scores;
create policy "scores_session_participant_select" on public.scores
  for select using (
    exists (
      select 1 from public.sessions s
      join public.session_participants sp
        on sp.session_id = s.id and sp.user_id = auth.uid()
      where s.work_version_id = scores.work_version_id
    )
  );

drop policy if exists "scores_admin_select" on public.scores;
create policy "scores_admin_select" on public.scores
  for select using (public.is_platform_admin());

drop policy if exists "score_pages_session_participant_select" on public.score_pages;
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

drop policy if exists "score_systems_session_participant_select" on public.score_systems;
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

-- ---------------------------------------------------------------------
-- 8. moderation_actions: permitir borrar usuarios con historial
-- ---------------------------------------------------------------------
alter table public.moderation_actions
  drop constraint if exists moderation_actions_admin_id_fkey;
alter table public.moderation_actions
  add constraint moderation_actions_admin_id_fkey
  foreign key (admin_id) references public.profiles(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 9. RPCs de sesión (SECURITY DEFINER)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 10. Realtime y seeds
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.admin_notifications;
    alter publication supabase_realtime add table public.sessions;
  end if;
exception
  when duplicate_object then null;
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
