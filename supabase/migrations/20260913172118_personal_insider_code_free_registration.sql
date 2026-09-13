create or replace function pi_private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare inv pi_private.invitations; approved boolean;
begin
 select * into inv from pi_private.invitations
 where email is not null and lower(email)=lower(new.email)
 and not consumed and expires>now()
 order by expires desc limit 1 for update;
 approved:=found;
 insert into pi_private.members(id,name,email,role,active)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Team member'),100),lower(new.email),
 case when approved then inv.role else 'Guest Relations' end,approved);
 if approved then
 update pi_private.invitations set consumed=true,used_by=new.id where token_hash=inv.token_hash;
 end if;
 return new;
end $$;
