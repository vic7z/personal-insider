'use client';
import {useState} from 'react';
import {Waves} from 'lucide-react';
import {api} from '../auth-panel';
export default function ResetPassword(){const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);return <main className="center-state"><div className="auth-box"><Waves size={40}/><h1>Choose a new password</h1><p className="muted">Open this page using the reset link in your email.</p>{done?<a className="primary" href="/">Back to sign in</a>:<form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('password')!==f.get('confirm')){setMessage('Passwords do not match');return}setBusy(true);try{const r=await api('/api/auth',{action:'change-password',password:f.get('password')});setMessage(r.message);setDone(true)}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}><label>New password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><label>Confirm password<input name="confirm" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><button className="primary" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>}{message&&<p role="status">{message}</p>}</div></main>}


