import {useEffect,useState} from 'react';
import {readResource,type Resource} from './resources';
/** Poll every 3 seconds; real data from PostgreSQL. `synced` is the time of the last successful refresh (drives the "Live" badge). */
export function useLive<T>(ref:Resource|null,deps:unknown[]=[]){
 const [items,setItems]=useState<T[]>([]),[error,setError]=useState(''),[synced,setSynced]=useState<number|null>(null);
 useEffect(()=>{setItems([]);setError('');setSynced(null);if(!ref)return;let active=true;const controller=new AbortController();const refresh=async()=>{try{const rows=await readResource(ref,controller.signal);if(active){setItems(rows as T[]);setError('');setSynced(Date.now())}}catch(err){if(active)setError((err as Error).message)}};void refresh();const timer=setInterval(()=>void refresh(),3000);return()=>{active=false;clearInterval(timer);controller.abort()}},deps);
 return{items,error,synced};
}
export function useDoc<T>(ref:Resource|null,deps:unknown[]=[]){
 const [value,setValue]=useState<T|null>(null),[error,setError]=useState('');
 useEffect(()=>{setValue(null);setError('');if(!ref)return;let active=true;const controller=new AbortController();const refresh=async()=>{try{const rows=await readResource(ref,controller.signal);if(active){setValue((rows[0]||null) as T|null);setError('')}}catch(err){if(active)setError((err as Error).message)}};void refresh();const timer=setInterval(()=>void refresh(),3000);return()=>{active=false;clearInterval(timer);controller.abort()}},deps);
 return{value,error};
}
