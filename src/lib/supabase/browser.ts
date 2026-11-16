"use client";
import {createBrowserClient} from "@supabase/ssr";
import type {SupabaseClient} from "@supabase/supabase-js";
let singleton:SupabaseClient|null=null;
export function browserClient():SupabaseClient{
 if(!singleton){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error("Supabase belum dikonfigurasi.");singleton=createBrowserClient(url,key);}
 return singleton;
}
