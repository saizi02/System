import {useCallback,useEffect,useRef,useState} from 'react';
/** Short two-tone chime using the Web Audio API (no audio files). Browsers only allow sound after a click, so it is opt-in. */
export function useChime(storageKey:string){
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(storageKey)==='on'}catch{return false}});
 const ctxRef=useRef<AudioContext|null>(null);
 const play=useCallback(()=>{
  if(!enabled)return;
  try{
   const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;ctxRef.current??=new Ctx();const ac=ctxRef.current;void ac.resume();
   [[880,0],[1175,0.18]].forEach(([freq,delay])=>{const osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0.0001,ac.currentTime+delay);gain.gain.exponentialRampToValueAtTime(0.25,ac.currentTime+delay+0.02);gain.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+delay+0.35);osc.connect(gain).connect(ac.destination);osc.start(ac.currentTime+delay);osc.stop(ac.currentTime+delay+0.4)});
  }catch{/* audio unavailable — the visual alert still shows */}
 },[enabled]);
 const toggle=()=>{const next=!enabled;setEnabled(next);try{localStorage.setItem(storageKey,next?'on':'off')}catch{/* ignore */}if(next){try{const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;ctxRef.current??=new Ctx();void ctxRef.current.resume()}catch{/* ignore */}}};
 return{enabled,toggle,play};
}
/** Calls `onArrive` with ids that appear after the first load (never for what was already on screen). */
export function useArrivals(ids:string[],ready:boolean,onArrive:(fresh:string[])=>void){
 const seen=useRef<Set<string>|null>(null);const key=ids.join('|');
 useEffect(()=>{
  if(!ready){seen.current=null;return}
  if(seen.current===null){seen.current=new Set(ids);return}
  const fresh=ids.filter(id=>!seen.current!.has(id));ids.forEach(id=>seen.current!.add(id));
  if(fresh.length)onArrive(fresh);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,ready]);
}
