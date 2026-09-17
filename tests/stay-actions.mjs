import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/domain.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'work/stay-domain.mjs'});
const {guestIn,dashboardSummary}=await import('../work/stay-domain.mjs');
const today='2026-09-17';
const booked={id:'1',arrival:today,departure:'2026-09-20',stay_status:'booked',archived:0,checkout_time:''};
assert.equal(guestIn(booked,'Arrivals',today),true);
assert.equal(guestIn(booked,'In-House',today),false);
assert.equal(guestIn({...booked,arrival:'2026-09-18'},'Arrivals',today),true);
const checkedIn={...booked,stay_status:'checked_in'};
assert.equal(guestIn(checkedIn,'Arrivals',today),false);
assert.equal(guestIn(checkedIn,'In-House',today),true);
assert.equal(guestIn(checkedIn,'In-House','2026-09-21'),true);
assert.equal(guestIn(checkedIn,'Departures','2026-09-21'),true);
for(const stay_status of ['checked_out','cancelled']){
 const ended={...booked,stay_status};
 for(const view of ['Guests','Arrivals','In-House','Departures'])assert.equal(guestIn(ended,view,today),false);
 assert.equal(guestIn(ended,'Archive',today),true);
 assert.deepEqual(dashboardSummary([ended],[],today,'12:00'),{arrivals:0,upcoming:0,inHouse:0,departures:0,checkedOut:0,moves:0});
}
console.log('Stay actions passed: booked, early check-in, overdue stay, checkout, cancellation, archive and card totals.');
