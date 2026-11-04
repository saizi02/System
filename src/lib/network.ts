import {useEffect,useState} from 'react';
/** Network indicator only; the server remains authoritative for stock and checkout. */
export function useOnline(){
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
 return online;
}
