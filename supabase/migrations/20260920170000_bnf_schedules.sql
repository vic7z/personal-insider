begin;
create table pi_private.bnf_schedules (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 160),
 start_date date not null,
 end_date date not null check(end_date>=start_date),
 details text not null check(length(details) between 1 and 80000),
 notes text not null default '' check(length(notes)<=6000),
 filename text not null check(length(filename) between 1 and 240),
 source_key text unique check(source_key in ('2026-09-08','2026-09-15')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table pi_private.bnf_schedules enable row level security;
revoke all on pi_private.bnf_schedules from public,anon,authenticated;
create policy "Direct table access disabled" on pi_private.bnf_schedules for all to anon,authenticated using(false) with check(false);

create function pi_private.bnf(b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor pi_private.members; result jsonb; new_id uuid;
begin
 actor:=pi_private.member_context();
 if b->>'action'='list' then
  select coalesce(jsonb_agg(to_jsonb(s)-'source_key'-'created_by' order by start_date desc,created_at desc),'[]'::jsonb) into result from pi_private.bnf_schedules s;
  return result;
 elsif b->>'action'='save' then
  if actor.role not in ('Admin','Guest Relations') then raise exception 'Your role has view-only access' using errcode='42501'; end if;
  insert into pi_private.bnf_schedules(title,start_date,end_date,details,notes,filename,created_by)
   values(trim(b->>'title'),(b->>'start_date')::date,(b->>'end_date')::date,trim(b->>'details'),coalesce(b->>'notes',''),b->>'filename',actor.id) returning id into new_id;
  return jsonb_build_object('id',new_id);
 end if;
 raise exception 'Unknown BNF action';
end $$;
create function public.pi_bnf(payload jsonb default '{"action":"list"}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select pi_private.bnf(payload)$$;
revoke all on function pi_private.bnf(jsonb),public.pi_bnf(jsonb) from public,anon;
grant execute on function pi_private.bnf(jsonb),public.pi_bnf(jsonb) to authenticated;
commit;
