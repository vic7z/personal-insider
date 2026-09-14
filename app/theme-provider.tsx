'use client';
import {ThemeProvider as Provider,useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';

export default function ThemeProvider({children}:{children:React.ReactNode}){
 return <Provider attribute="class" defaultTheme="system" enableSystem storageKey="personal-insider-theme" disableTransitionOnChange>{children}</Provider>;
}
export function ThemeToggle(){
 const {resolvedTheme,setTheme}=useTheme();
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 const dark=mounted&&resolvedTheme==='dark';
 return <button type="button" className="theme-toggle" disabled={!mounted} aria-label={dark?'Switch to light mode':'Switch to dark mode'} title={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(dark?'light':'dark')}>{dark?<Sun size={19}/>:<Moon size={19}/>}<span>{dark?'Light mode':'Dark mode'}</span></button>;
}
