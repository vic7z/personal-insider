import {z} from 'zod';
import {supabase,json,failure,body,sameOrigin,requireUser,check,HttpError} from '@/lib/server';
export async function GET(req:Request){const s=supabase(req);try{const {data}=await s.client.auth.getUser();if(!data.user)return s.finish(json({user:null,setup:false,setupEmail:null}));const {data:profile,error}=await s.client.rpc('pi_profile');if(error){await s.client.auth.signOut();return s.finish(json({user:null,setup:false,setupEmail:null,notice:'Your account is awaiting admin approval or has been deactivated.'}))}return s.finish(json({user:profile,setup:false,setupEmail:null}))}catch(e){return s.finish(failure(e))}}
export async function POST(req:Request){const s=supabase(req);try{sameOrigin(req);const b=await body(req);const action=z.enum(['register','login','reset','change-password','logout']).parse(b.action);
if(action==='logout'){const {error}=await s.client.auth.signOut();check(error);return s.finish(json({ok:true}))}
if(action==='change-password'){await requireUser(s.client);const password=z.string().min(12).max(128).parse(b.password);const {error}=await s.client.auth.updateUser({password});check(error);await s.client.auth.signOut();return s.finish(json({ok:true,message:'Password updated. Sign in with your new password.'}))}
const email=z.string().trim().email().max(254).parse(b.email).toLowerCase();
if(action==='reset'){const {error}=await s.client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=/reset-password',req.url).toString()});check(error);return s.finish(json({ok:true,message:'If this email has an account, a password-reset link will arrive shortly.'}))}
const password=z.string().min(12,'Use at least 12 characters').max(128).parse(b.password);
if(action==='register'){const name=z.string().trim().min(1).max(100).parse(b.name);const {data,error}=await s.client.auth.signUp({email,password,options:{data:{name,...(b.invite?{invitation_code:z.string().regex(/^[a-f0-9]{64}$/).parse(b.invite)}:{})},emailRedirectTo:new URL('/auth/callback',req.url).toString()}});check(error);return s.finish(json({ok:true,message:'Account created. Confirm your email, then sign in. If you joined through an invitation, your inviter must approve it first.'}))}
const {error}=await s.client.auth.signInWithPassword({email,password});if(error)throw new HttpError(401,error.message);
const {error:access}=await s.client.rpc('pi_profile');if(access){await s.client.auth.signOut();throw new HttpError(403,'Your account is awaiting admin approval or has been deactivated')}
return s.finish(json({ok:true}));
}catch(e){return s.finish(failure(e))}}

