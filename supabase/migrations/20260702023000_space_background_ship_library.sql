create or replace function public.admin_set_space_background_config(p_enabled boolean, p_config jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
declare
  v_config jsonb := coalesce(p_config, '{}'::jsonb);
  v_ship_library jsonb := coalesce(v_config->'shipLibrary', '[]'::jsonb);
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  if jsonb_typeof(v_ship_library) <> 'array' then
    v_ship_library := '[]'::jsonb;
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
    'trafficMode', coalesce(nullif(v_config->>'trafficMode', ''), 'balanced'),
    'shipLibrary', v_ship_library
  );

  insert into public.space_background_config (id, enabled, config, updated_at, updated_by)
  values ('home', coalesce(p_enabled, true), v_config, now(), auth.uid())
  on conflict (id) do update set enabled = excluded.enabled, config = excluded.config, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, true), 'config', v_config);
end;
$$;
