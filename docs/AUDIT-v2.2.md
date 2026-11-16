# NEXUS OBE — Audit Perbaikan v2.2

Tanggal audit source: 16 November 2026. Basis kerja: arsip `nexus-obe-portal-v2.1-audited.zip` dan PRD NEXUS OBE.

## Pekerjaan yang ditambahkan

| Alur | Perubahan source | Batas yang belum diuji |
|---|---|---|
| Login Google | `LoginForm` → `signInWithOAuth` → PKCE callback; callback menolak akun tanpa profil aktif/email terverifikasi yang cocok | Wajib setup provider Google dan uji di domain nyata |
| Login NIDN | API `auth/login` mengubah identifier dosen/staf menjadi email tersimpan setelah kontrol rate limit, lalu tetap menguji password | Uji akun dosen hasil undangan |
| Akun default Ibu Dian | Directory dan referensi kelas dimigrasikan ke NIDN `0421117105` | Belum ada email valid untuk membuat akun Auth. Tidak ada password default bersama |
| Undang user | Super Admin mengirim invite Supabase; endpoint tak pernah mengembalikan password sementara | SMTP dan template invite harus dikonfigurasi |
| OTP sandi | Form lupa sandi meminta OTP recovery via Supabase `verifyOtp`, lalu mengganti password | SMTP + template `{{ .Token }}` wajib; uji expiry dan replay |
| Google account linking | `linkIdentity` dari pengaturan, dengan pemeriksaan Google email sama seperti email terdaftar | Fitur manual linking harus diaktifkan di Supabase bila digunakan |
| Profil | Nama tampilan, foto WebP privat 500 KB, audit kolom yang boleh diubah | Uji RLS dan upload di Supabase nyata |
| Foto kelas | Sudah ada dari versi 2.1: dosen wajib upload foto WebP ketika memulai pertemuan; pembaca menggunakan signed URL | Uji storage dan izin peserta terdaftar |
| Tugas dan pengumuman | Menggunakan modul v2.1: multi-file, tautan, revisi, penilaian, pengingat | Uji workflow end-to-end dengan multi-user |
| Jadwal bentrok | Menggunakan pengecekan bentrok room/dosen/rombongan/peserta KRS/ujian dari v2.1 | Jalankan migration 002 + test transaksi pada database |
| Keamanan berkas | `.gitignore` diperketat, tidak ada kredensial di environment template | Scan git history yang sudah ada secara terpisah |
| Tampilan | Motif merah geometris dibuat sebagai SVG lokal, tidak bergantung pada hotlink Pinterest | Tinjau pada berbagai perangkat |

## Hasil pemeriksaan yang benar-benar dilakukan

- TypeScript parse check: **106 file TS/TSX, 0 diagnostic parse error** setelah perubahan.
- Test logika murni: **12/12 lulus**, dijalankan dengan Node.js strip-types dari copy sementara yang menyesuaikan ekstensi impor. Source asli test tetap menggunakan runner `tsx`.
- `tsc --noEmit -p tsconfig.engine.json`: **lulus** untuk subset kalkulator/tipe/dummy data.
- Import lokal: semua referensi alias `@/` yang diperiksa memiliki file target.
- Install dependency: **BELUM**; npm offline melaporkan `ENOTCACHED`.
- `npm run check` / build Next.js penuh: **BELUM**; perlu internet untuk npm install.
- SQL migrasi 003/004: **BELUM dieksekusi pada Supabase**.
- Google OAuth, OTP email, login NIDN, storage dan Role-based E2E: **BELUM diuji secara live**.
- Repository GitHub tidak diperbarui; akses git remote gagal (`Could not resolve host: github.com`).

## Temuan yang masih memerlukan tindakan institusi

1. Email resmi Ibu Dian dan email tiap dosen **tidak disertakan**, sehingga akun Auth tidak dibuat di sini.
2. NIDN Ibu Dian di PRD (`0431117105`) berbeda dari permintaan baru (`0421117105`). Migrasi mengikuti permintaan terbaru, tetapi admin harus mengonfirmasi nomor pada master resmi sebelum produksi.
3. OTP dari email perlu SMTP kustom dan template khusus Supabase.
4. Google OAuth perlu konfigurasi Client ID/Secret pada dashboard Supabase dan redirect allowlist.
5. Perlu kredensial server diset oleh pemilik di Vercel; **jangan dikirim ke chat**.
6. Perlu backup, privacy policy dan tes akses antar mahasiswa sebelum data nyata diimpor.

## Catatan kesiapan

Migrasi 004 dan Auth Hook Before User Created menolak pembuatan pengguna Google baru. Hanya akun yang diundang melalui email kampus dan disetujui pada allowlist yang boleh dibuat; identitas Google hanya ditautkan ke Auth user yang sudah ada. Hook ini **belum diaktifkan di dashboard live**.

Source ini **lebih lengkap dan lebih aman daripada v2.1**, tetapi **belum terbukti siap produksi** sampai checklist di `DEPLOYMENT-CHECKLIST.md` dilaksanakan dan lolos di lingkungan staging. Tidak ada klaim deployment atau penulisan database hidup.
