-- Synthetic users and schedule records are rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();r jsonb;role_name text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,'bnf-test-'||u||'@example.invalid',now(),'{"name":"BNF test"}');
 update pi_private.members set role='Admin',active=true where id=u;
 insert into auth.sessions(id,user_id) values(sid,u);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 foreach role_name in array array['Admin','Guest Relations'] loop
  update pi_private.members set role=role_name where id=u;
  r:=public.pi_bnf(jsonb_build_object('action','save','title','BNF test','start_date','2026-09-22','end_date','2026-09-28','details','Reviewed details only','filename','test.pdf'));
  if r->>'id' is null then raise exception 'Save failed';end if;
 end loop;
 foreach role_name in array array['Manager','Butler'] loop
  update pi_private.members set role=role_name where id=u;
  r:=public.pi_bnf('{"action":"list"}');
  if jsonb_array_length(r)<2 then raise exception 'Read failed';end if;
  begin perform public.pi_bnf('{"action":"save"}');raise exception 'Read-only role accepted';exception when insufficient_privilege then null;end;
 end loop;
 update pi_private.members set active=false where id=u;
 begin perform public.pi_bnf('{"action":"list"}');raise exception 'Inactive member accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.pi_bnf('{"action":"list"}');raise exception 'Anonymous caller accepted';exception when invalid_authorization_specification then null;end;
 if has_function_privilege('anon','public.pi_bnf(jsonb)','execute') then raise exception 'Anonymous RPC grant';end if;
 if has_table_privilege('authenticated','pi_private.bnf_schedules','select') then raise exception 'Direct table access enabled';end if;
 if exists(select 1 from information_schema.columns where table_schema='pi_private' and table_name='bnf_schedules' and column_name='object_path') then raise exception 'Unexpected file storage';end if;
end $test$;
rollback;
select 'BNF role checks passed; test records rolled back' as result;
