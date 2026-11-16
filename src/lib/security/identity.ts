import "server-only";
import type {User} from "@supabase/supabase-js";
/** OAuth must have a verified provider email and the same preprovisioned auth ID. */
export function verifiedUserEmail(user:User):string|null {
 const email=user.email?.trim().toLowerCase();
 if(!email||!user.email_confirmed_at)return null;
 // Manual identity linking allows different emails. The campus disallows that.
 for(const identity of user.identities??[]){
  if(identity.provider!=="google")continue;
  const googleEmail=identity.identity_data?.email;
  if(typeof googleEmail!=="string"||googleEmail.trim().toLowerCase()!==email)return null;
  if(identity.identity_data?.email_verified===false)return null;
 }
 return email;
}
export function sameRegisteredEmail(authEmail:string|null,profileEmail:string|null):boolean {
 return Boolean(authEmail&&profileEmail&&authEmail===profileEmail.trim().toLowerCase());
}
export function safeReturnOrigin(request:Request){
 const u=new URL(request.url);
 const forwardedHost=request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
 const forwardedProto=request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
 const configuredSite=process.env.NEXT_PUBLIC_SITE_URL;
 const allowedHosts=new Set<string>([u.host]);
 if(configuredSite){try{allowedHosts.add(new URL(configuredSite).host);}catch{/* Abaikan URL env tidak valid */}}
 const vercelPreview=Boolean(process.env.VERCEL&&forwardedHost&&/^[a-z0-9-]+\.vercel\.app$/i.test(forwardedHost));
 if(forwardedHost&&(allowedHosts.has(forwardedHost)||vercelPreview)){
  const proto=forwardedProto==="http"||forwardedProto==="https"?forwardedProto:"https";
  return `${proto}://${forwardedHost}`;
 }
 if(configuredSite&&/^https?:\/\//.test(configuredSite)&&u.hostname==="localhost"&&process.env.NODE_ENV==="production"){
  return configuredSite.replace(/\/$/,"");
 }
 return u.origin;
}
