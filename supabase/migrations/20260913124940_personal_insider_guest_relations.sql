
create schema if not exists pi_private;
revoke all on schema pi_private from public,anon;
grant usage on schema pi_private to authenticated;
create table pi_private.members(
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),
 email text not null unique, role text not null check(role in ('Admin','Guest Relations','Manager','Butler')),
 active boolean not null default true
);
create table pi_private.invitations(
 token_hash text primary key, email text, role text not null check(role in ('Admin','Guest Relations','Manager','Butler')),
 expires timestamptz not null,used_by uuid references auth.users(id) on delete set null,
 consumed boolean not null default false
);
create index pi_invitation_email on pi_private.invitations(email);
create index pi_invitation_used_by on pi_private.invitations(used_by);
create table pi_private.guests(
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
 room text not null check(length(trim(room)) between 1 and 20),
 meal_plan text not null default 'Breakfast' check(length(meal_plan)<=80),
 membership text not null default 'None' check(membership in ('None','Member','Silver Elite','Gold Elite','Platinum Elite','Titanium Elite','Ambassador Elite')),
 arrival date not null,departure date not null check(departure>=arrival),
 travel_agent text not null default '' check(length(travel_agent)<=160),
 celebration text not null default 'None' check(celebration in ('None','Birthday','Anniversary','Honeymoon','Proposal','Wedding','Other')),
 epic text not null default '' check(length(epic)<=1000),
 status text not null default 'Pending' check(status in ('Pending','In Progress','Confirmed','Done','Cancelled')),
 move_planned boolean not null default false,checkout_time text not null default '' check(checkout_time='' or checkout_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 notes text not null default '' check(length(notes)<=6000),archived integer not null default 0 check(archived in(0,1)),
 version integer not null default 1,created_at timestamptz not null default now()
);
create index pi_guests_dates on pi_private.guests(departure,arrival);
create table pi_private.moves(
 id uuid primary key default gen_random_uuid(),guest_id uuid not null references pi_private.guests(id),
 old_room text not null, new_room text not null check(length(trim(new_room)) between 1 and 20),
 move_date date not null,move_time text not null check(move_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 status text not null default 'Pending' check(status in ('Pending','In Progress','Confirmed','Done','Cancelled')),
 version integer not null default 1,check(new_room<>old_room)
);
create index pi_moves_guest on pi_private.moves(guest_id);
create index pi_moves_schedule on pi_private.moves(move_date,move_time);
create table pi_private.room_history(
 id bigint generated always as identity primary key,guest_id uuid not null references pi_private.guests(id),
 old_room text not null,new_room text not null,changed_at timestamptz not null default now(),reason text not null
);
create index pi_history_guest on pi_private.room_history(guest_id);
alter table pi_private.members enable row level security;
alter table pi_private.invitations enable row level security;
alter table pi_private.guests enable row level security;
alter table pi_private.moves enable row level security;
alter table pi_private.room_history enable row level security;
revoke all on all tables in schema pi_private from public,anon,authenticated;
-- No Data API table grants: private data is accessible only through checked RPCs.

create function pi_private.member_context() returns pi_private.members language plpgsql security definer set search_path='' as $$
declare m pi_private.members;
begin
 if auth.uid() is null then raise exception 'Please sign in' using errcode='28000'; end if;
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid()) then raise exception 'Session ended. Please sign in again' using errcode='28000'; end if;
 select * into m from pi_private.members where id=auth.uid() and active;
 if not found then raise exception 'Your account does not have active workspace access' using errcode='42501'; end if;
 return m;
end $$;
create function pi_private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare inv pi_private.invitations;
begin
 select * into inv from pi_private.invitations
 where token_hash=encode(extensions.digest(coalesce(new.raw_user_meta_data->>'invitation_code',''),'sha256'),'hex')
 and not consumed and expires>now() and (email is null or lower(email)=lower(new.email)) for update;
 if not found then raise exception 'A valid, unexpired invitation is required'; end if;
 insert into pi_private.members(id,name,email,role)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Team member'),100),lower(new.email),inv.role);
 update pi_private.invitations set consumed=true,used_by=new.id where token_hash=inv.token_hash;
 -- The invitation is validated against the database, never trusted as a role claim.
 return new;
end $$;
create trigger pi_register_member after insert on auth.users for each row execute function pi_private.on_signup();
create function pi_private.profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare m pi_private.members;
begin m:=pi_private.member_context();return to_jsonb(m)||jsonb_build_object('active',case when m.active then 1 else 0 end);end $$;
create function public.pi_profile() returns jsonb language sql security invoker set search_path='' as $$select pi_private.profile()$$;

create function pi_private.read_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare m pi_private.members;gs jsonb;ms jsonb;hs jsonb;
begin
 m:=pi_private.member_context();
 select coalesce(jsonb_agg(case when m.role='Butler' then to_jsonb(g)||'{"notes":"","epic":"","travel_agent":"","celebration":"None","membership":"None","meal_plan":""}'::jsonb else to_jsonb(g) end order by g.departure,g.room),'[]'::jsonb) into gs from pi_private.guests g;
 select coalesce(jsonb_agg(case when m.role='Butler' then to_jsonb(x)||'{"reason":""}'::jsonb else to_jsonb(x) end order by x.move_date,x.move_time,x.old_room),'[]'::jsonb) into ms from pi_private.moves x;
 if m.role='Butler' then hs:='[]'::jsonb;else select coalesce(jsonb_agg(to_jsonb(h) order by h.changed_at desc,h.id desc),'[]'::jsonb) into hs from pi_private.room_history h;end if;
 return jsonb_build_object('guests',gs,'moves',ms,'history',hs,'today',(now() at time zone 'Indian/Maldives')::date);
end $$;
create function public.pi_read() returns jsonb language sql security invoker set search_path='' as $$select pi_private.read_data()$$;

create function pi_private.mutate(b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   update pi_private.guests set name=trim(p->>'name'),room=trim(p->>'room'),meal_plan=p->>'meal_plan',membership=p->>'membership',arrival=(p->>'arrival')::date,departure=(p->>'departure')::date,travel_agent=coalesce(p->>'travel_agent',''),celebration=p->>'celebration',epic=coalesce(p->>'epic',''),status=p->>'status',move_planned=coalesce((p->>'move_planned')::boolean,false),checkout_time=coalesce(p->>'checkout_time',''),notes=coalesce(p->>'notes',''),version=version+1 where id=gid;
  else
   insert into pi_private.guests(name,room,meal_plan,membership,arrival,departure,travel_agent,celebration,epic,status,move_planned,checkout_time,notes)
   values(trim(p->>'name'),trim(p->>'room'),p->>'meal_plan',p->>'membership',(p->>'arrival')::date,(p->>'departure')::date,coalesce(p->>'travel_agent',''),p->>'celebration',coalesce(p->>'epic',''),p->>'status',coalesce((p->>'move_planned')::boolean,false),coalesce(p->>'checkout_time',''),coalesce(p->>'notes','')) returning id into gid;
  end if;
  return jsonb_build_object('id',gid);
 end if;
 gid:=(b->>'guest_id')::uuid;
 select * into g from pi_private.guests where id=gid for update;
 if not found then raise exception 'Guest not found';end if;
 if a in('archive','restore','status','departure') then
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
  if g.archived=1 or g.departure<t then raise exception 'Cannot move an archived guest';end if;
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
   if mv.move_date>t or g.archived=1 or g.departure<t then raise exception 'Only due moves for current stays can be completed';end if;
   if g.room<>mv.old_room then raise exception 'Current room changed. Edit this move before completing it';end if;
   insert into pi_private.room_history(guest_id,old_room,new_room,changed_at,reason) values(gid,g.room,mv.new_room,(mv.move_date+mv.move_time::time) at time zone 'Indian/Maldives',mv.reason);
   update pi_private.guests set room=mv.new_room,move_planned=false,version=version+1 where id=gid;
  end if;
  update pi_private.moves set status=s,version=version+1 where id=mid;
 else raise exception 'Unknown action';end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.pi_mutate(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select pi_private.mutate(payload)$$;

create function pi_private.team(b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor pi_private.members;target uuid;code text;r text;e text;result jsonb;
begin
 actor:=pi_private.member_context();if actor.role<>'Admin' then raise exception 'Admin access required' using errcode='42501';end if;
 if b->>'action'='invite' then
  e:=lower(trim(b->>'email'));r:=b->>'role';
  if e is null or e !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(e)>254 then raise exception 'Enter a valid email';end if;
  code:=encode(extensions.gen_random_bytes(32),'hex');
  update pi_private.invitations set expires=now() where email=e and not consumed;
  insert into pi_private.invitations(token_hash,email,role,expires) values(encode(extensions.digest(code,'sha256'),'hex'),e,r,now()+interval '24 hours');
  return jsonb_build_object('code',code,'email',e,'role',r);
 elsif b->>'action'='update' then
  target:=(b->>'id')::uuid;
  if target=actor.id then raise exception 'Ask another admin to change your own access';end if;
  -- Serialize admin changes to preserve at least one active admin under concurrency.
  perform pg_advisory_xact_lock(5817201);
  if not exists(select 1 from pi_private.members where id<>target and active and role='Admin') then raise exception 'Keep at least one active admin';end if;
  update pi_private.members set role=b->>'role',active=(b->>'active')::boolean where id=target;
  if not found then raise exception 'Member not found';end if;
  delete from auth.sessions where user_id=target;
  return '{"ok":true}'::jsonb;
 end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('active',case when m.active then 1 else 0 end) order by m.name),'[]'::jsonb) into result from pi_private.members m;
 return jsonb_build_object('users',result);
end $$;
create function public.pi_team(payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select pi_private.team(payload)$$;
revoke execute on all functions in schema pi_private from public,anon,authenticated;
grant execute on function pi_private.profile(),pi_private.read_data(),pi_private.mutate(jsonb),pi_private.team(jsonb) to authenticated;
revoke execute on function public.pi_profile(),public.pi_read(),public.pi_mutate(jsonb),public.pi_team(jsonb) from public,anon;
grant execute on function public.pi_profile(),public.pi_read(),public.pi_mutate(jsonb),public.pi_team(jsonb) to authenticated;

