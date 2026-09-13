import {supabase,json,failure,body,sameOrigin,requireUser,check} from '@/lib/server';
import {guestSchema} from '@/lib/domain';
export async function GET(req:Request){const s=supabase(req);try{await requireUser(s.client);const {data,error}=await s.client.rpc('pi_read');check(error);return s.finish(json(data))}catch(e){return s.finish(failure(e))}}
export async function POST(req:Request){const s=supabase(req);try{sameOrigin(req);await requireUser(s.client);const b=await body(req);if(b.action==='guest')b.guest=guestSchema.parse(b.guest);const {data,error}=await s.client.rpc('pi_mutate',{payload:b});check(error);return s.finish(json(data,b.action==='guest'&&!b.guest.id?201:200))}catch(e){return s.finish(failure(e))}}

