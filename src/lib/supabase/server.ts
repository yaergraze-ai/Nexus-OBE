import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
export function isSupabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);}
export async function createClient(){
 const store=await cookies();
 if(!isSupabaseConfigured())throw new Error("Supabase belum dikonfigurasi.");
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  cookies:{getAll(){return store.getAll();},setAll(records:{name:string;value:string;options:CookieOptions}[]){try{records.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Server Component tidak dapat memperbarui cookie; middleware menangani refresh. */}}}
 });
}
