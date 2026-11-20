-- =====================================================================
-- 0005_fix_works_rls_recursion.sql
-- Rompe la recursión infinita de RLS entre `works` y `work_versions`
-- (y entre `sessions` y `session_participants`) usando funciones
-- SECURITY DEFINER con search_path fijo.
-- =====================================================================

create or replace function public.is_work_owner(p_work_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.works w
    where w.id = p_work_id and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_work_session_participant(p_work_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.work_versions wv
    join public.sessions s on s.work_version_id = wv.id
    join public.session_participants sp
      on sp.session_id = s.id and sp.user_id = auth.uid()
    where wv.work_id = p_work_id
  );
$$;

create or replace function public.is_session_director(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id and s.director_user_id = auth.uid()
  );
$$;

grant execute on function public.is_work_owner(uuid) to authenticated;
grant execute on function public.is_work_session_participant(uuid) to authenticated;
grant execute on function public.is_session_director(uuid) to authenticated;

-- 1. Romper ciclo works <-> work_versions
drop policy if exists "works_session_participant_select" on public.works;
create policy "works_session_participant_select" on public.works
  for select using (public.is_work_session_participant(id));

drop policy if exists "work_versions_owner_all" on public.work_versions;
create policy "work_versions_owner_all" on public.work_versions
  for all using (public.is_work_owner(work_id))
  with check (public.is_work_owner(work_id));

-- 2. Romper ciclo potencial sessions <-> session_participants
drop policy if exists "session_participants_director_select" on public.session_participants;
create policy "session_participants_director_select" on public.session_participants
  for select using (public.is_session_director(session_id));
