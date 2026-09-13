import {supabase} from '@/lib/server';
export async function GET(req:Request){const s=supabase(req);const u=new URL(req.url);const code=u.searchParams.get('code');const next=u.searchParams.get('next')==='/reset-password'?'/reset-password':'/';if(code){const {error}=await s.client.auth.exchangeCodeForSession(code);if(!error)return s.finish(Response.redirect(new URL(next,u.origin),303))}return s.finish(Response.redirect(new URL('/?auth_error=This+email+link+has+expired.+Please+try+again.',u.origin),303))}

