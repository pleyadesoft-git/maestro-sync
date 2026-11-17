-- =====================================================================
-- MIGRACIÓN 0003: Actualización de Tiers de Precios
-- Solo ($5 USD/mes), Band ($65 USD/mes, 2 a 20 músicos), Orchestra ($95 USD/mes)
-- =====================================================================

insert into public.plans (code, name, plan_type, ensemble_type, seats_included, billing_interval,
                          price_cents, seat_price_cents, max_members, trial_days, is_active) values
  ('solo_monthly',      'Solo',                        'individual',   null,       1, 'month',  500,   0, null, null, true),
  ('solo_annual',       'Solo anual',                  'individual',   null,       1, 'year',   5100,  0, null, null, true),
  ('band_monthly',      'Band (2 a 20 músicos)',       'organization', 'band',     0, 'month',  6500,  0, 20,   null, true),
  ('band_annual',       'Band anual (2 a 20 músicos)', 'organization', 'band',     0, 'year',   66300, 0, 20,   null, true),
  ('orchestra_monthly', 'Orchestra',                   'organization', 'orchestra',0, 'month',  9500,  0, null, null, true),
  ('orchestra_annual',  'Orchestra anual',             'organization', 'orchestra',0, 'year',   96900, 0, null, null, true)
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

-- Actualizar también los registros legacy individual_monthly e individual_annual
update public.plans
set price_cents = 500, name = 'Solo'
where code = 'individual_monthly';

update public.plans
set price_cents = 5100, name = 'Solo anual'
where code = 'individual_annual';
