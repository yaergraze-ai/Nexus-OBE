# NEXUS OBE — Panduan dari Nol (bahasa mudah)

> Ini **aplikasi sungguhan** dengan database, bukan hanya gambar. Kita perlu memasang dan mengetesnya sebelum mahasiswa memakai. Bayangkan website sebagai sekolah, database sebagai lemari arsip, dan kunci API sebagai kunci ruang arsip. Jangan pernah menaruh kunci itu di GitHub.

## 1. Barang yang perlu disiapkan

- Komputer dengan **Node.js 22+**, Git, dan editor kode seperti VS Code.
- Akun **Supabase** yang sudah dibuat untuk proyek NEXUS OBE.
- Repository GitHub: `https://github.com/yaergraze-ai/Nexus-OBE.git`.
- Akun Google Cloud untuk mengaktifkan tombol **Masuk dengan Google**.
- Email kampus yang benar untuk setiap dosen, termasuk Ibu Dian. **NIDN saja tidak cukup** untuk mengirim undangan email.
- Layanan pengirim email SMTP untuk OTP pemulihan (wajib saat produksi).

## 2. Siapkan proyek di komputer

Buka Terminal di folder proyek ini dan jalankan:

```bash
npm install
cp .env.example .env.local
```

Jika Windows dan `cp` tidak bekerja, gunakan `copy .env.example .env.local` di Command Prompt.

**Jangan unggah `.env.local` ke GitHub.** File ini berisi rahasia. Hanya `.env.example` tanpa isi kunci yang boleh dibagikan.

## 3. Hubungkan Supabase

Buka proyek **Nexus-OBE** di Supabase (Project ID: `fkxwxldxrrwzpuywripu`). Buka **Settings → API Keys** untuk menyalin nilai yang dibutuhkan. **Jangan kirimkan key lewat chat, screenshot, commit, atau README.**

Buka `.env.local` di komputer Anda sendiri, isi:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://fkxwxldxrrwzpuywripu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<isi publishable/anon key dari dashboard sendiri>
SUPABASE_SERVICE_ROLE_KEY=<isi secret/service role hanya di server>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
LOGIN_RATE_LIMIT_SECRET=<acak sekurang-kurangnya 32 karakter>
CRON_SECRET=<acak sekurang-kurangnya 32 karakter>
```

Angka dan kata di dalam `<...>` hanyalah penjelasan, **bukan** nilai yang bisa dipakai. Buat rahasia secara lokal. Jangan pernah menambahkan prefix `NEXT_PUBLIC_` ke secret.

## 4. Buat tabel database

Di dashboard Supabase → **SQL Editor**, jalankan file dalam urutan berikut, satu per satu:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_communication_assignments.sql`
3. `supabase/seed.sql` (hanya database baru)
4. `supabase/migrations/003_identity_profiles.sql` (memperbarui NIDN Ibu Dian)
5. `supabase/migrations/004_google_signup_allowlist.sql` (mengunci pendaftaran akun Google baru)

**Urutan terbaik untuk database baru:** `001 → 002 → seed → 003 → 004`. Untuk database v2.1 yang sudah ada, jalankan **003 kemudian 004**; jangan ulangi `001` dan `002` sembarangan. Simpan cadangan database lebih dahulu.

**Sesudah menjalankan 004:** di dashboard Supabase → **Authentication → Hooks → Before User Created**, pilih **Postgres Function** `public.hook_campus_invite_only` dan aktifkan. Lakukan **setelah akun Super Admin pertama disiapkan**. Hook ini mencegah pembuatan user Google baru di luar sistem undangan, sehingga akun Google hanya dapat dihubungkan ke akun kampus yang sudah ada.

Foto BAP berada di Storage bucket privat `bap-documents`. File tugas juga privat. Migrasi 003 menambah bucket foto profil privat.

## 5. Google login (satu email = satu identitas kampus)

Buka **Google Cloud Console → Credentials**. Buat **OAuth client ID (Web application)**. Tambahkan redirect yang diberikan Supabase di **Authentication → Providers → Google**. Salin Google Client ID/Secret langsung ke dashboard **Supabase → Authentication → Providers → Google**. **Jangan taruh Google Client Secret di repository.**

Di Supabase **Authentication → URL Configuration**, atur Site URL dan Redirect URLs sesuai alamat website Anda. Masukkan alamat lokal `http://localhost:3000/api/auth/callback` dan nanti domain Vercel Anda. Aktifkan **manual identity linking** bila ingin tombol Hubungkan Google di halaman keamanan.

**Aturan penting:** akun harus diundang/didaftarkan admin terlebih dahulu dengan email tepat. Supabase dapat menghubungkan Google dan email yang sama jika keduanya terverifikasi, tanpa membuat akun Auth kedua. Jika tidak berhasil otomatis, login memakai email dahulu, lalu gunakan **Pengaturan → Keamanan → Hubungkan Google**. Akun Google yang tidak terdaftar tidak bisa melihat portal.

## 6. OTP lupa kata sandi

Supabase → **Authentication → Email Templates → Reset Password**, ubah isi menjadi:

```html
<h2>Atur ulang kata sandi NEXUS OBE</h2>
<p>OTP Anda: <strong>{{ .Token }}</strong></p>
<p>Jangan berikan kode ini kepada siapa pun. Abaikan email jika bukan Anda yang meminta.</p>
```

Aktifkan SMTP sendiri pada **Authentication → SMTP Settings** agar email betul-betul terkirim kepada mahasiswa/dosen. Pengiriman bawaan Supabase terbatas untuk percobaan. Tes kode yang benar, salah, dan kedaluwarsa.

## 7. Buat akun dan undang dosen

**Atur template undangan dahulu:** Supabase → Authentication → Email Templates → Invite user. Gunakan tautan berbentuk `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` supaya aplikasi memverifikasi undangan secara aman. Test dengan email milik operator sebelum mengundang dosen.

Jangan buat password dosen yang sama untuk semua orang. Super Admin membuka **Pengguna → Tambah Pengguna** dan mengisi email kampus, nama, NIDN, role Dosen. Sistem mengirim undangan dan dosen membuat password sendiri.

- Ibu **Dian Novianti**: nomor login sesuai permintaan terbaru **`0421117105`**.
- Dosen lain memakai nomor induk masing-masing dari daftar kampus, tetapi **harus punya email nyata**.
- Mahasiswa menggunakan email terdaftar atau Google dengan email yang sama.
- Admin dan Super Admin memakai email + password + MFA TOTP.

**Akun Super Admin pertama:** perlu dibuat secara aman oleh operator database di Supabase Auth lalu dilengkapi satu record `profiles` dengan ID yang sama. Jangan menyediakan akun admin publik dengan password contoh. Setelah login, aktifkan MFA.

## 8. Jalankan dan coba

```bash
npm run dev
```

Buka `http://localhost:3000`. `http://localhost:3000/demo` **hanya halaman simulasi**, bukan bukti database produksi.

Coba 4 role di akun nyata: dosen membuat foto pertemuan, mahasiswa melakukan presensi dan mengumpulkan berkas/tautan GitHub, dosen menilai, admin mengatasi jadwal bentrok, Super Admin memeriksa audit. Pastikan fitur menolak orang yang tidak berhak.

## 9. Keamanan sebelum GitHub

```bash
git status --short
git check-ignore .env.local
npm run lint
npm run typecheck
npm run test
npm run build
```

Perintah `git check-ignore .env.local` **harus** menghasilkan `.env.local`. Jika sebelumnya key sudah pernah masuk ke Git, menghapusnya saja tidak cukup: **rotasi (ganti) semua key yang pernah bocor**. Jangan jalankan `git add -f .env.local`. Aktifkan GitHub secret scanning dan branch protection.

Untuk upload ke repo, operator dengan akses GitHub harus menjalankan `git add`, `git commit`, dan `git push` di komputer yang sudah login. File ZIP ini **belum otomatis dikirim ke GitHub**.

## 10. Deploy Vercel

Hubungkan repository GitHub di Vercel. Isi setiap environment variable di **Vercel Project Settings → Environment Variables**, **bukan** di file yang di-commit. Tambahkan domain produksi ke Supabase URL Configuration dan OAuth Google. Jadwalkan cron sesuai `vercel.json`; gunakan `CRON_SECRET` agar endpoint tidak dapat dipicu sembarang orang.

## 11. Pemeriksaan produksi wajib

Sebelum mahasiswa sungguhan memakai, operator harus memastikan: login dengan email, NIDN dosen, dan Google; Google email berbeda ditolak; OTP sampai ke kotak masuk; MFA dosen/admin aktif; foto BAP bisa diunggah dan hanya terlihat peserta yang berhak; tugas multiberkas bisa diunggah, diperbarui, dan dinilai; tidak ada tabrakan ruang/dosen/mahasiswa; notifikasi terkirim sesuai izin browser; serta database punya backup.

**Catatan:** hasil pengecekan source code tidak menggantikan pengetesan layanan Supabase dan Vercel sungguhan.
