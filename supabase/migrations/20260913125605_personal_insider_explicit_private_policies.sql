create policy "Direct table access disabled" on pi_private.members for all to anon,authenticated using (false) with check (false);
create policy "Direct table access disabled" on pi_private.invitations for all to anon,authenticated using (false) with check (false);
create policy "Direct table access disabled" on pi_private.guests for all to anon,authenticated using (false) with check (false);
create policy "Direct table access disabled" on pi_private.moves for all to anon,authenticated using (false) with check (false);
create policy "Direct table access disabled" on pi_private.room_history for all to anon,authenticated using (false) with check (false);
