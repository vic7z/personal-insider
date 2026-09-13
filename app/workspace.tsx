'use client';
import {useCallback,useEffect,useState} from 'react';
import {Waves,RefreshCw} from 'lucide-react';
import AuthPanel,{api} from './auth-panel';
import Dashboard from './dashboard';
import type {User} from '@/lib/domain';
export default function Workspace(){const [auth,setAuth]=useState<{user:User|null;setup:boolean;setupEmail:string|null}|null>(null);const [error,setError]=useState('');const refresh=useCallback(async()=>{try{setError('');setAuth(await api('/api/auth'))}catch(e){setError((e as Error).message)}},[]);useEffect(()=>{refresh();if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})},[refresh]);if(error)return <main className="center-state"><Waves size={40}/><h1>Personal Insider</h1><p role="alert">{error}</p><button className="primary" onClick={refresh}><RefreshCw size={18}/>Try again</button></main>;if(!auth)return <main className="center-state"><Waves size={40}/><h1>Personal Insider</h1><p role="status">Opening your workspace…</p></main>;return auth.user?<Dashboard user={auth.user} onLogout={refresh}/>:<AuthPanel setup={auth.setup} setupEmail={auth.setupEmail} onLogin={refresh}/>}

