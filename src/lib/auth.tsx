import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {apiRequest} from './api';
import type {Portal,Role} from './types';
export type StaffUser={uid:string;email:string;role:Role;displayName?:string;businessId?:string;branchId?:string;mustChangePassword:boolean};
type Session={user:StaffUser|null;connectionError:string|null;role:Role|null;businessId?:string;branchId?:string;mustChangePassword:boolean;loading:boolean;login:(email:string,password:string,portal?:Portal)=>Promise<StaffUser>;logout:()=>Promise<void>;refresh:()=>Promise<void>};
const ctx=createContext<Session>({user:null,connectionError:null,role:null,mustChangePassword:false,loading:true,login:async()=>{throw Error('Not ready')},logout:async()=>{},refresh:async()=>{}});
export const useSession=()=>useContext(ctx);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<StaffUser|null>(null),[loading,setLoading]=useState(true),[connectionError,setConnectionError]=useState<string|null>(null);
 const refresh=async()=>{const session=await apiRequest<{user:StaffUser|null}>('/auth/me');setUser(session.user);setConnectionError(null)};
 useEffect(()=>{let mounted=true;apiRequest<{user:StaffUser|null}>('/auth/me').then(v=>{if(mounted){setUser(v.user);setConnectionError(null)}}).catch(e=>{console.warn('API session unavailable',e);if(mounted)setConnectionError('Cannot connect to SSTWAS Node.js API. Start npm run api:dev and verify PostgreSQL is running.')}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[]);
 // `portal` makes the server accept the sign-in only if the account belongs to that standalone dashboard.
 const login=async(email:string,password:string,portal?:Portal)=>{const result=await apiRequest<{user:StaffUser}>('/auth/login',{email,password,...(portal?{portal}:{})});setUser(result.user);setConnectionError(null);return result.user};
 const logout=async()=>{await apiRequest('/auth/logout',{});setUser(null)};
 return <ctx.Provider value={{user,connectionError,role:user?.role||null,businessId:user?.businessId,branchId:user?.branchId,mustChangePassword:user?.mustChangePassword||false,loading,login,logout,refresh}}>{children}</ctx.Provider>;
}
