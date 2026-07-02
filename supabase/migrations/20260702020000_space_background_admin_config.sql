create table if not exists public.space_background_config (
  id text primary key default 'home',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.space_background_config enable row level security;

drop policy if exists "space background public read" on public.space_background_config;
create policy "space background public read"
  on public.space_background_config for select
  using (true);

insert into public.space_background_config (id, enabled, config)
values (
  'home',
  true,
  jsonb_build_object(
    'stars', 1.0,
    'ships', 1.0,
    'shipMax', 6,
    'speed', 1.0,
    'asteroids', 0.55,
    'planets', 0.35,
    'satellites', 0.25,
    'crashes', 0.12,
    'nebula', 0.7,
    'shake', 0.45,
    'trafficMode', 'balanced'
  )
)
on conflict (id) do nothing;

create or replace function public.admin_get_space_background_config()
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  return (
    select jsonb_build_object('ok', true, 'id', id, 'enabled', enabled, 'config', config, 'updated_at', updated_at)
    from public.space_background_config
    where id = 'home'
  );
end;
$$;

create or replace function public.admin_set_space_background_config(p_enabled boolean, p_config jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
declare
  v_config jsonb := coalesce(p_config, '{}'::jsonb);
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  v_config := jsonb_build_object(
    'stars', least(greatest(coalesce((v_config->>'stars')::numeric, 1), 0), 2.5),
    'ships', least(greatest(coalesce((v_config->>'ships')::numeric, 1), 0), 3),
    'shipMax', least(greatest(coalesce((v_config->>'shipMax')::int, 6), 0), 14),
    'speed', least(greatest(coalesce((v_config->>'speed')::numeric, 1), 0.2), 3),
    'asteroids', least(greatest(coalesce((v_config->>'asteroids')::numeric, 0.55), 0), 2.5),
    'planets', least(greatest(coalesce((v_config->>'planets')::numeric, 0.35), 0), 2),
    'satellites', least(greatest(coalesce((v_config->>'satellites')::numeric, 0.25), 0), 2),
    'crashes', least(greatest(coalesce((v_config->>'crashes')::numeric, 0.12), 0), 1),
    'nebula', least(greatest(coalesce((v_config->>'nebula')::numeric, 0.7), 0), 2),
    'shake', least(greatest(coalesce((v_config->>'shake')::numeric, 0.45), 0), 1),
    'trafficMode', coalesce(nullif(v_config->>'trafficMode', ''), 'balanced')
  );

  insert into public.space_background_config (id, enabled, config, updated_at, updated_by)
  values ('home', coalesce(p_enabled, true), v_config, now(), auth.uid())
  on conflict (id) do update set enabled = excluded.enabled, config = excluded.config, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, true), 'config', v_config);
end;
$$;

revoke execute on function public.admin_get_space_background_config() from anon;
grant execute on function public.admin_get_space_background_config() to authenticated;
revoke execute on function public.admin_set_space_background_config(boolean, jsonb) from anon;
grant execute on function public.admin_set_space_background_config(boolean, jsonb) to authenticated;
