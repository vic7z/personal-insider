-- Existing stays retain their automatic date flow; new bookings require check-in.
alter table pi_private.guests add column stay_status text not null default 'auto'
 check (stay_status in ('auto','booked','checked_in','checked_out','cancelled'));
alter table pi_private.guests alter column stay_status set default 'booked';
alter table pi_private.guests add column checked_in_at timestamptz;
alter table pi_private.guests add column checked_out_at timestamptz;
alter table pi_private.guests add column cancelled_at timestamptz;

create or replace function pi_private.mutate(b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor pi_private.members;g pi_private.guests;mv pi_private.moves;p jsonb;gid uuid;mid uuid;s text;d date;t date:=(now() at time zone 'Indian/Maldives')::date;v integer;a text:=b->>'action';
begin
 actor:=pi_private.member_context();
 if actor.role not in ('Admin','Guest Relations') then raise exception 'Your role has view-only access' using errcode='42501';end if;
 if a='guest' then
  p:=b->'guest';gid:=nullif(p->>'id','')::uuid;
  if gid is not null then
   select * into g from pi_private.guests where id=gid for update;
   if not found then raise exception 'Guest not found';end if;
   if g.version<>coalesce((p->>'version')::integer,0) then raise exception 'Guest changed. Refresh and try again' using errcode='40001';end if;
   if exists(select 1 from pi_private.moves where guest_id=gid and status not in('Done','Cancelled') and (move_date<(p->>'arrival')::date or move_date>(p->>'departure')::date)) then raise exception 'Reschedule moves outside the new stay dates first';end if;
   if g.room<>p->>'room' then insert into pi_private.room_history(guest_id,old_room,new_room,reason) values(gid,g.room,p->>'room','Room updated in guest profile');end if;
   update pi_private.guests set name=trim(p->>'name'),room=trim(p->>'room'),meal_plan=p->>'meal_plan',membership=p->>'membership',arrival=(p->>'arrival')::date,departure=(p->>'departure')::date,travel_agent=coalesce(p->>'travel_agent',''),celebration=p->>'celebration',epic=coalesce(p->>'epic',''),epic_status=coalesce(p->>'epic_status',g.epic_status),feedback=coalesce(p->>'feedback',g.feedback),status=p->>'status',move_planned=coalesce((p->>'move_planned')::boolean,false),checkout_time=coalesce(p->>'checkout_time',''),notes=coalesce(p->>'notes',''),version=version+1 where id=gid;
  else
   insert into pi_private.guests(name,room,meal_plan,membership,arrival,departure,travel_agent,celebration,epic,epic_status,feedback,status,move_planned,checkout_time,notes)
   values(trim(p->>'name'),trim(p->>'room'),p->>'meal_plan',p->>'membership',(p->>'arrival')::date,(p->>'departure')::date,coalesce(p->>'travel_agent',''),p->>'celebration',coalesce(p->>'epic',''),coalesce(p->>'epic_status','Pending'),coalesce(p->>'feedback',''),p->>'status',coalesce((p->>'move_planned')::boolean,false),coalesce(p->>'checkout_time',''),coalesce(p->>'notes','')) returning id into gid;
  end if;
  return jsonb_build_object('id',gid);
 end if;
 gid:=(b->>'guest_id')::uuid;
 select * into g from pi_private.guests where id=gid for update;
 if not found then raise exception 'Guest not found';end if;
 if a in ('check-in','check-out','cancel-booking') then
  if g.version<>coalesce((b->>'version')::integer,0) then raise exception 'Guest changed. Refresh and try again' using errcode='40001';end if;
  if g.archived=1 or g.stay_status in ('checked_out','cancelled') then raise exception 'This stay has already ended or been archived';end if;
  if a='check-in' then
   if g.stay_status='checked_in' then raise exception 'Guest is already checked in';end if;
   if g.departure<t then raise exception 'Update the departure date before checking in';end if;
   update pi_private.guests set stay_status='checked_in',checked_in_at=now(),arrival=least(arrival,t),version=version+1 where id=gid;
  elsif a='check-out' then
   if g.stay_status<>'checked_in' and not(g.stay_status='auto' and g.arrival<=t) then raise exception 'Check in the guest before checking out';end if;
   update pi_private.guests set stay_status='checked_out',checked_out_at=now(),departure=t,checkout_time=to_char(now() at time zone 'Indian/Maldives','HH24:MI'),move_planned=false,version=version+1 where id=gid;
  else
   if g.stay_status='checked_in' then raise exception 'Use Check out for a checked-in guest';end if;
   update pi_private.guests set stay_status='cancelled',cancelled_at=now(),move_planned=false,version=version+1 where id=gid;
  end if;
  if a in ('check-out','cancel-booking') then
   update pi_private.moves set status='Cancelled',version=version+1 where guest_id=gid and status not in ('Done','Cancelled');
  end if;
 elsif a in('archive','restore','status','departure') then
  if g.version<>coalesce((b->>'version')::integer,0) then raise exception 'Guest changed. Refresh and try again' using errcode='40001';end if;
  if a in('archive','restore') then update pi_private.guests set archived=case when a='archive' then 1 else 0 end,version=version+1 where id=gid;
  elsif a='status' then update pi_private.guests set status=b->>'status',version=version+1 where id=gid;
  else
   d:=(b->>'departure')::date;
   if d<g.arrival then raise exception 'Checkout cannot be before arrival';end if;
   if exists(select 1 from pi_private.moves where guest_id=gid and move_date>d and status not in('Done','Cancelled')) then raise exception 'Reschedule later room moves before changing checkout';end if;
   update pi_private.guests set departure=d,checkout_time=b->>'checkout_time',notes=b->>'notes',status=b->>'status',version=version+1 where id=gid;
  end if;
 elsif a='move' then
  if g.archived=1 or g.stay_status in ('checked_out','cancelled') or (g.departure<t and g.stay_status<>'checked_in') then raise exception 'Cannot move an archived guest';end if;
  p:=b->'move';d:=(p->>'move_date')::date;
  if d<t or d<g.arrival or d>g.departure then raise exception 'Move date must be today or later and within this stay';end if;
  if p->>'new_room'=g.room then raise exception 'Choose a different room';end if;
  mid:=nullif(p->>'id','')::uuid;
  if mid is null then insert into pi_private.moves(guest_id,old_room,new_room,move_date,move_time,reason) values(gid,g.room,trim(p->>'new_room'),d,p->>'move_time',p->>'reason');
  else
   select * into mv from pi_private.moves where id=mid and guest_id=gid for update;
   if not found or mv.version<>coalesce((p->>'version')::integer,0) or mv.status in('Done','Cancelled') then raise exception 'Move changed or completed. Refresh and try again' using errcode='40001';end if;
   update pi_private.moves set old_room=g.room,new_room=trim(p->>'new_room'),move_date=d,move_time=p->>'move_time',reason=p->>'reason',version=version+1 where id=mid;
  end if;
 elsif a='move-status' then
  mid:=(b->>'move_id')::uuid;s:=b->>'status';
  select * into mv from pi_private.moves where id=mid and guest_id=gid for update;
  if not found or mv.version<>coalesce((b->>'version')::integer,0) or mv.status in('Done','Cancelled') then raise exception 'Move changed or completed. Refresh and try again' using errcode='40001';end if;
  if s='Done' then
   if mv.move_date>t or g.archived=1 or g.stay_status in ('checked_out','cancelled') or (g.departure<t and g.stay_status<>'checked_in') then raise exception 'Only due moves for current stays can be completed';end if;
   if g.room<>mv.old_room then raise exception 'Current room changed. Edit this move before completing it';end if;
   insert into pi_private.room_history(guest_id,old_room,new_room,changed_at,reason) values(gid,g.room,mv.new_room,(mv.move_date+mv.move_time::time) at time zone 'Indian/Maldives',mv.reason);
   update pi_private.guests set room=mv.new_room,move_planned=false,version=version+1 where id=gid;
  end if;
  update pi_private.moves set status=s,version=version+1 where id=mid;
 else raise exception 'Unknown action';end if;
 return jsonb_build_object('ok',true);
end $$;
