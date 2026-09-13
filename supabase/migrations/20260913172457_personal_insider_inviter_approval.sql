alter table pi_private.invitations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table pi_private.invitations add column if not exists approval_status text not null default 'waiting' check(approval_status in ('waiting','accepted','approved','rejected'));
create index if not exists pi_invitation_creator on pi_private.invitations(created_by);
create or replace function pi_private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare inv pi_private.invitations; matched boolean; code text:=nullif(new.raw_user_meta_data->>'invitation_code','');
begin
 select * into inv from pi_private.invitations where email is not null and lower(email)=lower(new.email)
 and not consumed and expires>now() order by expires desc limit 1 for update;
 matched:=found;
 if code is not null and (not matched or inv.token_hash<>encode(extensions.digest(code,'sha256'),'hex')) then raise exception 'Invalid or expired invitation';end if;
 insert into pi_private.members(id,name,email,role,active)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Team member'),100),lower(new.email),
 case when matched then inv.role else 'Guest Relations' end,
 not matched or inv.created_by is null);
 if matched then update pi_private.invitations set consumed=true,used_by=new.id,approval_status=case when created_by is null then 'approved' else 'accepted' end where token_hash=inv.token_hash;end if;
 return new;
end $$;
create or replace function pi_private.team(b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor pi_private.members;target uuid;code text;r text;e text;result jsonb;pending jsonb;inv pi_private.invitations;
begin
 actor:=pi_private.member_context();
 if b->>'action'='invite' then
  e:=lower(trim(b->>'email'));r:=case when actor.role='Admin' then b->>'role' else actor.role end;
  if e is null or e !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(e)>254 then raise exception 'Enter a valid email';end if;
  if exists(select 1 from pi_private.members where email=e) then raise exception 'This person already has an account';end if;
  perform pg_advisory_xact_lock(hashtextextended(e,0));
  if exists(select 1 from pi_private.invitations where email=e and not consumed and expires>now()) then raise exception 'This email already has a pending invitation';end if;
  code:=encode(extensions.gen_random_bytes(32),'hex');
  insert into pi_private.invitations(token_hash,email,role,expires,created_by) values(encode(extensions.digest(code,'sha256'),'hex'),e,r,now()+interval '24 hours',actor.id);
  return jsonb_build_object('code',code,'email',e,'role',r);
 elsif b->>'action' in ('approve-invite','reject-invite') then
  select * into inv from pi_private.invitations where token_hash=b->>'id' and created_by=actor.id and approval_status='accepted' for update;
  if not found then raise exception 'Accepted invitation not found' using errcode='42501';end if;
  if b->>'action'='approve-invite' then
   if inv.role='Admin' and actor.role<>'Admin' then raise exception 'Admin access required' using errcode='42501';end if;
   update pi_private.members set active=true,role=inv.role where id=inv.used_by;
  end if;
  update pi_private.invitations set approval_status=case when b->>'action'='approve-invite' then 'approved' else 'rejected' end where token_hash=inv.token_hash;
  return '{"ok":true}'::jsonb;
 elsif b->>'action'='update' then
  if actor.role<>'Admin' then raise exception 'Admin access required' using errcode='42501';end if;
  target:=(b->>'id')::uuid;
  if target=actor.id then raise exception 'Ask another admin to change your own access';end if;
  if exists(select 1 from pi_private.invitations where used_by=target and approval_status='accepted') then raise exception 'The inviter must approve this accepted invitation first';end if;
  perform pg_advisory_xact_lock(5817201);
  if not exists(select 1 from pi_private.members where id<>target and active and role='Admin') then raise exception 'Keep at least one active admin';end if;
  update pi_private.members set role=b->>'role',active=(b->>'active')::boolean where id=target;
  if not found then raise exception 'Member not found';end if;
  delete from auth.sessions where user_id=target;
  return '{"ok":true}'::jsonb;
 end if;
 if actor.role='Admin' then
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('active',case when m.active then 1 else 0 end) order by m.name),'[]'::jsonb) into result from pi_private.members m;
 else result:='[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',token_hash,'email',email,'role',role,'status',approval_status,'expires',expires) order by expires desc),'[]'::jsonb) into pending from pi_private.invitations where created_by=actor.id;
 return jsonb_build_object('users',result,'invitations',pending);
end $$;
