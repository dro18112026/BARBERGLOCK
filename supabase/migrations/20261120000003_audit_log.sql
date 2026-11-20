-- =============================================================================
-- Audit log: who changed what, and when. Readable by superadmins only.
--
-- actor_role: 'barber' / 'superadmin' (panel), 'web' (customer booking through
-- the website's server), 'anon' (customer cancel link), 'sistema' (scheduled
-- jobs / SQL editor). For updates only the changed columns are stored.
-- Entries older than the retention period are purged (see purge_personal_data).
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'PURGE')),
  table_name  text not null,
  row_id      text,
  old_data    jsonb,
  new_data    jsonb
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "Superadmins read audit log" on public.audit_log
  for select to authenticated using ((select public.is_superadmin()));

-- Who is acting right now, as a short label.
create or replace function public.current_actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.my_role()::text,
    case coalesce((select auth.jwt() ->> 'role'), '')
      when 'service_role' then 'web'
      when 'anon' then 'anon'
      when 'authenticated' then 'usuario'
      else 'sistema'
    end
  );
$$;

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old  jsonb;
  v_new  jsonb;
  v_id   text;
begin
  -- Data-retention purges switch auditing off for their own changes.
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id');

  if tg_op = 'UPDATE' then
    -- Keep only the columns that actually changed.
    select jsonb_object_agg(n.key, n.value) into v_new
    from jsonb_each(to_jsonb(new)) n
    where to_jsonb(old) -> n.key is distinct from n.value;

    if v_new is null then
      return null; -- nothing changed
    end if;

    select jsonb_object_agg(o.key, o.value) into v_old
    from jsonb_each(to_jsonb(old)) o
    where v_new ? o.key;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, table_name, row_id, old_data, new_data)
  values ((select auth.uid()), public.current_actor_role(), tg_op, tg_table_name, v_id, v_old, v_new);

  return null;
end;
$$;

revoke execute on function public.audit_trigger(), public.current_actor_role() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'appointments', 'services', 'working_hours', 'time_off', 'booking_settings', 'barbers', 'staff'
  ] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
