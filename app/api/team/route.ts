import {supabase,json,failure,body,sameOrigin,requireUser,check} from '@/lib/server';
export async function GET(req:Request){const s=supabase(req);try{await requireUser(s.client);const {data,error}=await s.client.rpc('pi_team',{payload:{}});check(error);return s.finish(json(data))}catch(e){return s.finish(failure(e))}}
export async function POST(req:Request){const s=supabase(req);try{sameOrigin(req);await requireUser(s.client);const payload=await body(req);const {data,error}=await s.client.rpc('pi_team',{payload});check(error);return s.finish(json(data))}catch(e){return s.finish(failure(e))}}

