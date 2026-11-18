-- =====================================================================
-- MIGRACIÓN 0004: Códigos de Cortesía de 1 Mes (30 días)
-- Generados desde el Panel de Administración (Solo, Band, Orchestra)
-- =====================================================================

create table if not exists public.courtesy_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  plan_code text not null check (plan_code in ('solo_monthly', 'band_monthly', 'orchestra_monthly')),
  duration_days int not null default 30,
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked', 'expired')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courtesy_codes_code on public.courtesy_codes(code);
create index if not exists idx_courtesy_codes_status on public.courtesy_codes(status);
create index if not exists idx_courtesy_codes_redeemed_by on public.courtesy_codes(redeemed_by);

drop trigger if exists trg_courtesy_codes_updated_at on public.courtesy_codes;
create trigger trg_courtesy_codes_updated_at
  before update on public.courtesy_codes
  for each row execute function public.set_updated_at();

alter table public.courtesy_codes enable row level security;

drop policy if exists "courtesy_codes_admin_all" on public.courtesy_codes;
create policy "courtesy_codes_admin_all" on public.courtesy_codes
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "courtesy_codes_redeemer_select" on public.courtesy_codes;
create policy "courtesy_codes_redeemer_select" on public.courtesy_codes
  for select using (redeemed_by = auth.uid());

revoke insert, update, delete on public.courtesy_codes from anon, authenticated;
