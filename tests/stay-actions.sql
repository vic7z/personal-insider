-- Transactional integration test: all synthetic users and guests are rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();gid uuid;cancel_id uuid;r jsonb;v integer;t date:=(now() at time zone 'Indian/Maldives')::date;p jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,'stay-test-'||u||'@example.invalid',now(),'{"name":"Stay action test"}');
 update pi_private.members set role='Admin',active=true where id=u;
 insert into auth.sessions(id,user_id) values(sid,u);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 p:=jsonb_build_object('name','Stay action test','room','QA101','meal_plan','Breakfast only','membership','None','arrival',t,'departure',t+2,'celebration','None','status','Pending');
 r:=public.pi_mutate(jsonb_build_object('action','guest','guest',p));gid:=(r->>'id')::uuid;
 if (select stay_status from pi_private.guests where id=gid)<>'booked' then raise exception 'Booking default failed';end if;
 perform public.pi_mutate(jsonb_build_object('action','check-in','guest_id',gid,'version',1));
 if not exists(select 1 from pi_private.guests where id=gid and stay_status='checked_in' and checked_in_at is not null) then raise exception 'Check-in failed';end if;
 begin perform public.pi_mutate(jsonb_build_object('action','check-out','guest_id',gid,'version',1));raise exception 'Stale version accepted';exception when serialization_failure then null;end;
 perform public.pi_mutate(jsonb_build_object('action','move','guest_id',gid,'move',jsonb_build_object('new_room','QA102','move_date',t+1,'move_time','12:00','reason','Test')));
 perform public.pi_mutate(jsonb_build_object('action','check-out','guest_id',gid,'version',2));
 if not exists(select 1 from pi_private.guests where id=gid and stay_status='checked_out' and checked_out_at is not null and departure=t) then raise exception 'Checkout failed';end if;
 if exists(select 1 from pi_private.moves where guest_id=gid and status<>'Cancelled') then raise exception 'Move cleanup failed';end if;
 r:=public.pi_mutate(jsonb_build_object('action','guest','guest',p));cancel_id:=(r->>'id')::uuid;
 perform public.pi_mutate(jsonb_build_object('action','cancel-booking','guest_id',cancel_id,'version',1));
 if not exists(select 1 from pi_private.guests where id=cancel_id and stay_status='cancelled' and cancelled_at is not null) then raise exception 'Cancellation failed';end if;
 update pi_private.members set role='Manager' where id=u;
 begin perform public.pi_mutate(jsonb_build_object('action','check-in','guest_id',cancel_id,'version',2));raise exception 'Read-only role accepted';exception when insufficient_privilege then null;end;
end $test$;
rollback;
select 'Stay action integration tests passed; synthetic records rolled back' as result;
