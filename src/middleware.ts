import {NextResponse,type NextRequest} from "next/server";
import {createServerClient,type CookieOptions} from "@supabase/ssr";
const protectedPrefixes=["/dashboard","/kelas","/jadwal","/tugas","/pengumuman","/nilai","/krs","/rps-review","/pengguna","/audit","/notifikasi","/pengaturan"];
function isProtected(path:string){return protectedPrefixes.some(p=>path===p||path.startsWith(p+"/"));}
function supabaseConnectOrigin(){
 const raw=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!raw)return "";
 try{const u=new URL(raw);return `${u.origin} wss://${u.host}`;}catch{return "";}
}
export async function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 const nonce=btoa(crypto.randomUUID());
 const development=process.env.NODE_ENV!=="production";
 const extraConnect=supabaseConnectOrigin();
 const csp=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'","form-action 'self'",
  "img-src 'self' data: blob: https:","style-src 'self' 'unsafe-inline'","font-src 'self' data:",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":""}`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${extraConnect?` ${extraConnect}`:""}`,
  "worker-src 'self' blob:",...(development?[]:["upgrade-insecure-requests"])].join("; ");
 const headers=new Headers(request.headers);headers.set("x-nonce",nonce);headers.set("Content-Security-Policy",csp);
 const secure=(res:NextResponse)=>{res.headers.set("Content-Security-Policy",csp);return res;};
 const redirectTo=(url:string)=>secure(NextResponse.redirect(new URL(url,request.url)));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key){if(isProtected(path))return redirectTo("/login?error=setup");return secure(NextResponse.next({request:{headers}}));}
 let response=secure(NextResponse.next({request:{headers}}));
 const db=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll();},setAll(records:{name:string;value:string;options:CookieOptions}[]){
  records.forEach(({name,value})=>request.cookies.set(name,value));
  headers.set("cookie",request.cookies.toString());
  response=secure(NextResponse.next({request:{headers}}));
  records.forEach(({name,value,options})=>response.cookies.set(name,value,options));
 }}});
 const {data:{user}}=await db.auth.getUser();
 if(!user){if(isProtected(path))return redirectTo("/login");return response;}
 const {data:profile}=await db.from("profiles").select("role,is_active,email").eq("id",user.id).maybeSingle();
 const validCampusUser=Boolean(profile?.is_active&&user.email_confirmed_at&&profile.email.trim().toLowerCase()===user.email?.trim().toLowerCase());
 if(!validCampusUser){
  if(isProtected(path))return redirectTo("/login?error=inactive");
  return response;
 }
 const recoveryFlow=path==="/login"&&request.nextUrl.searchParams.get("mode")==="new-password";
 if(path==="/login"&&!recoveryFlow)return redirectTo("/dashboard");
 if(profile?.is_active&&["dosen","admin","super_admin"].includes(profile.role)&&isProtected(path)&&path!=="/pengaturan/keamanan"){
  const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aal?.currentLevel!=="aal2")return redirectTo("/pengaturan/keamanan");
 }
 const restrict:[string,string[]][]=[
  ["/krs",["admin","super_admin"]],["/nilai",["dosen","admin","super_admin"]],
  ["/rps-review",["admin","super_admin"]],["/pengguna",["super_admin"]],["/audit",["super_admin"]]
 ];
 if(restrict.some(([route,roles])=>(path===route||path.startsWith(route+"/"))&&!roles.includes(profile?.role||"")))return redirectTo("/dashboard");
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|preview-standalone.html|sw.js|api/).*)"]};
