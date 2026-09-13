import {z} from 'zod';
export const statuses=['Pending','In Progress','Confirmed','Done','Cancelled'] as const;
export const memberships=['None','Member','Silver Elite','Gold Elite','Platinum Elite','Titanium Elite','Ambassador Elite'] as const;
export const celebrations=['None','Birthday','Anniversary','Honeymoon','Proposal','Wedding','Other'] as const;
export const roles=['Admin','Guest Relations','Manager','Butler'] as const;
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===v},'Enter a valid date');
export const timeSchema=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const guestSchema=z.object({id:z.string().max(80).optional(),version:z.number().int().optional(),name:z.string().trim().min(1).max(160),room:z.string().trim().min(1).max(20),meal_plan:z.string().max(80).default('Breakfast'),membership:z.enum(memberships),arrival:dateSchema,departure:dateSchema,travel_agent:z.string().max(160).default(''),celebration:z.enum(celebrations),epic:z.string().max(1000).default(''),status:z.enum(statuses),move_planned:z.boolean().default(false),checkout_time:z.union([timeSchema,z.literal('')]).default(''),notes:z.string().max(6000).default('')}).refine(g=>g.departure>=g.arrival,'Departure cannot be before arrival');
export type Guest=z.infer<typeof guestSchema>&{id:string;version:number;archived:number;created_at:string};
export type Move={id:string;guest_id:string;old_room:string;new_room:string;move_date:string;move_time:string;reason:string;status:typeof statuses[number];version:number};
export type RoomHistory={id:number;guest_id:string;old_room:string;new_room:string;changed_at:string;reason:string};
export type User={id:string;name:string;email:string;role:typeof roles[number];active:number};
export function resortToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function archived(g:Guest,today:string){return Boolean(g.archived)||g.departure<today}
export function guestIn(g:Guest,view:string,today:string){if(view==='Archive')return archived(g,today);if(archived(g,today))return false;if(view==='Arrivals')return g.arrival>=today;if(view==='In-House')return g.arrival<=today&&g.departure>=today;if(view==='Departures')return g.departure===today;return true}
export function matchesGuest(g:Guest,q:string,moves:Move[]=[],history:RoomHistory[]=[]){const hay=[g.name,g.room,g.membership,g.travel_agent,...moves.filter(m=>m.guest_id===g.id).flatMap(m=>[m.old_room,m.new_room]),...history.filter(m=>m.guest_id===g.id).flatMap(m=>[m.old_room,m.new_room])].join(' ').toLowerCase();return hay.includes(q.trim().toLowerCase())}
export function sortGuests(a:Guest,b:Guest,view:string){if(view==='Departures')return (a.checkout_time||'99:99').localeCompare(b.checkout_time||'99:99')||a.room.localeCompare(b.room,undefined,{numeric:true});return (view==='Arrivals'?a.arrival.localeCompare(b.arrival):a.departure.localeCompare(b.departure))||a.room.localeCompare(b.room,undefined,{numeric:true})}
export function sortMoves(a:Move,b:Move){return a.move_date.localeCompare(b.move_date)||a.move_time.localeCompare(b.move_time)||a.old_room.localeCompare(b.old_room,undefined,{numeric:true})}
export function displayDate(d:string){return new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Indian/Maldives'})}

