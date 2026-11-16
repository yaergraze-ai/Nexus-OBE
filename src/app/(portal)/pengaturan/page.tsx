import Link from "next/link";
import {sessionContext} from "@/lib/auth";import {SectionHead,Tag} from "@/components/UI";import {ROLE_LABEL} from "@/types/domain";import {ProfileEditor} from "@/components/ProfileEditor";
export default async function SettingsPage(){const {profile,db}=await sessionContext();
 const avatar=await db.from("profiles").select("avatar_url").eq("id",profile.id).maybeSingle();
 const signed=avatar.data?.avatar_url?await db.storage.from("profile-avatars").createSignedUrl(avatar.data.avatar_url,600):null;
 return <><SectionHead eyebrow="PROFIL AKADEMIK" title="Profil dan Pengaturan" subtitle="Ubah nama tampilan, foto, keamanan, dan pengingat kelas Anda."/>
 <div className="details-grid"><section className="panel"><div className="panelhead"><h2>Identitas Kampus</h2><Tag kind="good">Aktif</Tag></div>
 {signed?.data?.signedUrl&&<img src={signed.data.signedUrl} alt="Foto profil Anda" width={96} height={96} style={{borderRadius:16,objectFit:"cover",marginBottom:14}}/>}
 <div className="stat-line"><span>Nama lengkap</span><strong>{profile.full_name}</strong></div><div className="stat-line"><span>NIM / NIDN</span><strong>{profile.identity_number}</strong></div><div className="stat-line"><span>Email kampus terdaftar</span><strong>{profile.email}</strong></div><div className="stat-line"><span>Peran</span><strong>{ROLE_LABEL[profile.role]}</strong></div>
 <p className="field-hint" style={{marginTop:16}}>NIM/NIDN, peran, dan email tidak bisa diganti sendiri. Hubungi admin agar identitas Google dan email tetap cocok.</p></section>
 <section className="panel"><div className="panelhead"><h2>Ubah profil</h2></div><ProfileEditor initialName={profile.full_name}/><hr style={{border:0,borderTop:"1px solid var(--line)",margin:"20px 0"}}/><div className="form-actions"><Link href="/notifikasi" className="btn btn-secondary"><i className="bi bi-bell"/> Notifikasi</Link><Link href="/pengaturan/keamanan" className="btn btn-secondary"><i className="bi bi-shield-lock"/> Sandi & MFA</Link></div></section></div></>;
}
