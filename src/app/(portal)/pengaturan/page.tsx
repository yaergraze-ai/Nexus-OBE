import Link from "next/link";
import { sessionContext } from "@/lib/auth";
import { SectionHead, Tag } from "@/components/UI";
import { ROLE_LABEL } from "@/types/domain";
import { ProfileEditor } from "@/components/ProfileEditor";
import { EmailSettingsCard } from "@/components/EmailSettingsCard";

export default async function SettingsPage() {
  const { profile, db } = await sessionContext();
  const signed = profile.avatar_url
    ? await db.storage.from("profile-avatars").createSignedUrl(profile.avatar_url, 3600)
    : null;
  const avatarUrl = signed?.data?.signedUrl ?? null;

  return (
    <>
      <SectionHead
        eyebrow="PROFIL AKADEMIK"
        title="Profil dan Pengaturan"
        subtitle="Ubah nama tampilan, foto profil (PP), email OTP, keamanan, dan pengingat kelas Anda."
      />
      <div className="details-grid">
        <section className="panel">
          <div className="panelhead">
            <h2>Identitas Kampus</h2>
            <Tag kind="good">Aktif</Tag>
          </div>
          <div className="stat-line">
            <span>Nama lengkap</span>
            <strong>{profile.full_name}</strong>
          </div>
          <div className="stat-line">
            <span>NIM / NIDN</span>
            <strong>{profile.identity_number}</strong>
          </div>
          <div className="stat-line">
            <span>Email terdaftar</span>
            <strong>{profile.email}</strong>
          </div>
          <div className="stat-line">
            <span>Peran</span>
            <strong>{ROLE_LABEL[profile.role]}</strong>
          </div>
          <p className="field-hint" style={{ marginTop: 16 }}>
            NIM/NIDN dan peran dikelola admin. Nama tampilan, foto profil (PP), dan email
            OTP dapat Anda perbarui langsung di halaman ini.
          </p>
        </section>

        <section className="panel">
          <div className="panelhead">
            <h2>Ubah Profil &amp; Foto (PP)</h2>
          </div>
          <ProfileEditor initialName={profile.full_name} initialAvatarUrl={avatarUrl} />
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
          <div className="form-actions">
            <Link href="/notifikasi" className="btn btn-secondary">
              <i className="bi bi-bell" /> Notifikasi
            </Link>
            <Link href="/pengaturan/keamanan" className="btn btn-secondary">
              <i className="bi bi-shield-lock" /> Sandi &amp; MFA
            </Link>
          </div>
        </section>
      </div>
      <div style={{ marginTop: 20 }}>
        <EmailSettingsCard currentEmail={profile.email} />
      </div>
    </>
  );
}
