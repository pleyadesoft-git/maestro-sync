-- =====================================================================
-- MIGRACIÓN 0006: Códigos de Cortesía de 7 días (antes 30 días)
-- =====================================================================

-- Nuevo valor por defecto para códigos generados
alter table public.courtesy_codes
  alter column duration_days set default 7;

-- Ajustar códigos aún no canjeados para que otorguen 7 días
update public.courtesy_codes
set duration_days = 7
where status = 'active'
  and duration_days = 30;
