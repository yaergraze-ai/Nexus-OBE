# NEXUS OBE v2.2 — Portal Akademik Full Stack

**Panduan awal untuk pemula:** [PANDUAN-MULAI-DARI-NOL.md](PANDUAN-MULAI-DARI-NOL.md)

Next.js 15 / React 19 / strict TypeScript / Supabase Postgres Auth Storage Realtime / Tailwind.

## Ringkas
- 4-role RBAC: mahasiswa, dosen, admin, super_admin.
- Foto kelas WebP (maksimum 500 KB) disimpan privat.
- Pengumuman, tugas, pengumpulan revisi banyak lampiran, tautan GitHub/Google Drive.
- RPS, validasi, pertemuan, absensi, PAP dan CPL, jadwal anti-bentrok, notifikasi.
- Login email atau nomor induk dosen/staf + password, Google yang cocok dengan profil kampus, pemulihan sandi via OTP email.
- Profil, avatar privat, pengaturan keamanan dan MFA.

## Mengaktifkan backend

Sebelum produksi, siapkan Supabase, jalankan migrasi dan seed dalam urutan `001 → 002 → seed → 003 → 004`, aktifkan hook pendaftaran, SMTP dan Google OAuth, isi environment hanya secara privat, dan jalankan tes empat peran.

```bash
npm install
cp .env.example .env.local
npm run dev
npm run check
```

**Belum ada klaim produksi terverifikasi sebelum migrasi, test e2e, SMTP, Storage dan Vercel dijalankan pada project nyata.**

Jangan commit `.env.local`, key secret, kredensial SMTP atau hasil database.
