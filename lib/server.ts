import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import {z} from 'zod';
import {supabaseUrl,supabaseKey} from './supabase-config';
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
export function failure(e:unknown){if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.message).join('. ')},400);console.error('Personal Insider request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Unable to complete this request. Please try again.'},503)}
export async function body(req:Request){if(!req.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'JSON required');const raw=await req.text();if(raw.length>20000)throw new HttpError(413,'Request too large');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Invalid request')}}
export function sameOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'Please use this app to make changes')}
export function supabase(req:Request){const responseHeaders=new Headers();const jar=new Map(parseCookieHeader(req.headers.get('cookie')??'').map(c=>[c.name,c.value??'']));
const client=createServerClient(supabaseUrl,supabaseKey,{cookieOptions:{httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',path:'/'},cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll(items){for(const {name,value,options}of items){jar.set(name,value);responseHeaders.append('Set-Cookie',serializeCookieHeader(name,value,{...options,httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',path:'/'}))}}}});
return {client,finish(res:Response){res=new Response(res.body,{status:res.status,statusText:res.statusText,headers:new Headers(res.headers)});for(const [k,v]of responseHeaders){if(k!=='set-cookie')res.headers.set(k,v)}for(const c of responseHeaders.getSetCookie())res.headers.append('Set-Cookie',c);res.headers.set('Cache-Control','no-store, private');return res}}}
export function check(error:any){if(!error)return;const code=error.code;throw new HttpError(code==='42501'?403:code==='28000'||code==='PGRST301'?401:code==='40001'?409:400,error.message||'Request failed')}
export async function requireUser(client:ReturnType<typeof supabase>['client']){const {data,error}=await client.auth.getUser();if(error||!data.user)throw new HttpError(401,'Please sign in again');return data.user}

