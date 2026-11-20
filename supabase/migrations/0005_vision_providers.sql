-- =====================================================================
-- MIGRACIÓN 0005: Proveedores de Visión IA con Failover y Prioridad
-- Administrados desde el Panel de Administración (CRUD + Drag & Drop)
-- =====================================================================

create table if not exists public.ai_vision_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type text not null check (provider_type in ('gemini', 'zhipu', 'qwen', 'openrouter', 'openai', 'openai_compatible')),
  base_url text,
  model_name text not null,
  api_key text not null,
  priority int not null default 1,
  is_enabled boolean not null default true,
  notes text,
  last_status text not null default 'untested' check (last_status in ('untested', 'ok', 'error')),
  last_error text,
  last_tested_at timestamptz,
  success_count int not null default 0,
  failure_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_vision_providers_priority
  on public.ai_vision_providers(is_enabled, priority asc);

drop trigger if exists trg_ai_vision_providers_updated_at on public.ai_vision_providers;
create trigger trg_ai_vision_providers_updated_at
  before update on public.ai_vision_providers
  for each row execute function public.set_updated_at();

alter table public.ai_vision_providers enable row level security;

drop policy if exists "ai_vision_providers_admin_all" on public.ai_vision_providers;
create policy "ai_vision_providers_admin_all" on public.ai_vision_providers
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Seguridad estricta: jamás exponer API keys a anon ni authenticated.
-- Solo el backend con service_role puede leer/operar esta tabla.
revoke all on public.ai_vision_providers from anon, authenticated;
