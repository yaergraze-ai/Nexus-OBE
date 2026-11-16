// Jalankan hanya dari mesin admin, bukan klien browser.
// USERS_JSON='[{"email":"...","password":"...","identity_number":"...","full_name":"...","role":"admin"}]' node scripts/provision-users.mjs
import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key||!process.env.USERS_JSON)throw new Error('Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY dan USERS_JSON');
const users=JSON.parse(process.env.USERS_JSON);
if(!Array.isArray(users)||users.length>100)throw new Error('USERS_JSON harus array dengan maksimal 100 akun');
const allowed=new Set(['mahasiswa','dosen','admin','super_admin']);
const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
for(const u of users){
 if(!u.email||!u.password||u.password.length<12||!u.identity_number||!u.full_name||!allowed.has(u.role))throw new Error('Atribut akun tidak lengkap atau password <12 karakter');
 const {data,error}=await supabase.auth.admin.createUser({email:u.email,password:u.password,email_confirm:true});
 if(error)throw error;
 const {error:profileError}=await supabase.from('profiles').insert({id:data.user.id,email:u.email,identity_number:u.identity_number,full_name:u.full_name,role:u.role});
 if(profileError){await supabase.auth.admin.deleteUser(data.user.id);throw profileError;}
 process.stdout.write(`Akun dibuat: ${u.email} (${u.role})\n`);
}
