import {sessionContext} from "@/lib/auth";
import {SectionHead} from "@/components/UI";
import {MfaSettings} from "@/components/MfaSettings";
import {AccountSecurity} from "@/components/AccountSecurity";
export default async function SecurityPage(){const {profile}=await sessionContext();return <><SectionHead eyebrow="AKUN AMAN" title="Keamanan akun" subtitle="Kelola sandi, akun Google yang terhubung, serta verifikasi dua langkah."/><div style={{marginBottom:20}}><AccountSecurity/></div><MfaSettings role={profile.role}/></>}
