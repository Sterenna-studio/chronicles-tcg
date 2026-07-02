create table if not exists public.space_background_config_backups (
  id uuid primary key default gen_random_uuid(),
  config_id text not null default 'home',
  label text,
  enabled boolean not null default true,
  config jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.space_background_config_backups enable row level security;

drop policy if exists "space_background_backups_superuser_select" on public.space_background_config_backups;
create policy "space_background_backups_superuser_select"
on public.space_background_config_backups
for select
to authenticated
using (public._is_superuser());

drop policy if exists "space_background_backups_superuser_insert" on public.space_background_config_backups;
create policy "space_background_backups_superuser_insert"
on public.space_background_config_backups
for insert
to authenticated
with check (public._is_superuser());

create or replace function public.admin_backup_space_background_config(p_label text default null)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
declare
  v_row public.space_background_config%rowtype;
  v_id uuid;
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  select * into v_row from public.space_background_config where id = 'home';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Configuration introuvable');
  end if;

  insert into public.space_background_config_backups(config_id,label,enabled,config,created_by)
  values ('home', coalesce(nullif(p_label,''),'Backup admin'), v_row.enabled, v_row.config, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_list_space_background_backups(p_limit int default 12)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  return jsonb_build_object(
    'ok', true,
    'backups', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'enabled', enabled, 'created_at', created_at, 'config', config) order by created_at desc)
      from (
        select * from public.space_background_config_backups
        where config_id = 'home'
        order by created_at desc
        limit least(greatest(coalesce(p_limit,12),1),50)
      ) b
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_restore_space_background_backup(p_backup_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' set row_security to 'off'
as $$
declare
  v_backup public.space_background_config_backups%rowtype;
begin
  if not public._is_superuser() then
    return jsonb_build_object('ok', false, 'error', 'Acces refuse');
  end if;

  select * into v_backup from public.space_background_config_backups where id = p_backup_id and config_id = 'home';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Backup introuvable');
  end if;

  insert into public.space_background_config(id, enabled, config, updated_at, updated_by)
  values ('home', v_backup.enabled, v_backup.config, now(), auth.uid())
  on conflict (id) do update set enabled = excluded.enabled, config = excluded.config, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'enabled', v_backup.enabled, 'config', v_backup.config);
end;
$$;

grant execute on function public.admin_backup_space_background_config(text) to authenticated;
grant execute on function public.admin_list_space_background_backups(int) to authenticated;
grant execute on function public.admin_restore_space_background_backup(uuid) to authenticated;
