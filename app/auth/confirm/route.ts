import {supabase} from '@/lib/server';
export async function GET(req:Request){const s=supabase(req);const u=new URL(req.url);const token_hash=u.searchParams.get('token_hash');const type=u.searchParams.get('type');if(token_hash&&(type==='email'||type==='recovery')){const {error}=await s.client.auth.verifyOtp({token_hash,type});if(!error)return s.finish(Response.redirect(new URL(type==='recovery'?'/reset-password':'/',u.origin),303))}return s.finish(Response.redirect(new URL('/?auth_error=This+email+link+has+expired.+Please+try+again.',u.origin),303))}

