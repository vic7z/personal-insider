import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/domain.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'work/dashboard-domain.mjs'});
const {dashboardSummary,guestIn,resortClock}=await import('../work/dashboard-domain.mjs');
const guests=[
 {id:'today',arrival:'2026-09-14',departure:'2026-09-14',checkout_time:'11:30',archived:0},
 {id:'tomorrow',arrival:'2026-09-15',departure:'2026-09-17',checkout_time:'12:00',archived:0},
 {id:'staying',arrival:'2026-09-13',departure:'2026-09-16',checkout_time:'',archived:0},
 {id:'manual',arrival:'2026-09-14',departure:'2026-09-14',checkout_time:'',archived:1},
];
assert.deepEqual(dashboardSummary(guests,[],'2026-09-14','11:29'),{arrivals:1,upcoming:1,inHouse:2,departures:1,checkedOut:0,moves:0});
assert.deepEqual(dashboardSummary(guests,[],'2026-09-14','11:30'),{arrivals:1,upcoming:1,inHouse:1,departures:1,checkedOut:1,moves:0});
assert.equal(guestIn(guests[0],'Departures','2026-09-14','20:00'),true);
assert.equal(guestIn(guests[0],'Archive','2026-09-14','20:00'),true);
assert.equal(guestIn(guests[0],'In-House','2026-09-14','20:00'),false);
assert.deepEqual(dashboardSummary(guests,[],'2026-09-15','00:00'),{arrivals:1,upcoming:0,inHouse:2,departures:0,checkedOut:0,moves:0});
assert.deepEqual(resortClock(new Date('2026-09-14T19:00:00Z')),{date:'2026-09-15',time:'00:00'});
for(const time of ['00:00','11:29','11:30','23:59']){
 const summary=dashboardSummary(guests,[],'2026-09-14',time);
 assert.equal(summary.departures,guests.filter(g=>guestIn(g,'Departures','2026-09-14',time)).length);
 assert.equal(summary.inHouse,guests.filter(g=>guestIn(g,'In-House','2026-09-14',time)).length);
}
console.log('Dashboard regressions passed: daily totals, checkout, midnight, upcoming, manual archives, list/count consistency.');

