# Daftar Periksa Sebelum Dipakai di Kampus

Centang setiap kotak **setelah benar-benar diuji di Supabase dan Vercel**, bukan hanya setelah file dibuat.

## Database dan akun
- [ ] Backup database sebelum migrasi, uji migrasi 003 di staging, lalu produksi.
- [ ] Konfirmasi NIDN Dian **0421117105** cocok data kemahasiswaan asli; pastikan **email** disetujui institusi.
- [ ] Tidak ada akun contoh/default dengan kata sandi yang diketahui umum.
- [ ] Super Admin pertama dibuat melalui proses privat, aktifkan TOTP MFA.
- [ ] Migrasi 004 dieksekusi dan `hook_campus_invite_only` diaktifkan pada Supabase Authentication > Hooks setelah bootstrap Super Admin.
- [ ] Google belum terdaftar gagal membuat auth.users baru, bukan hanya gagal masuk portal.
- [ ] Pembuatan akun baru menghasilkan email undangan, bukan password yang ditampilkan.
- [ ] Google terdaftar yang terverifikasi masuk ke auth.users yang **sama** dengan akun email.
- [ ] Google email berbeda dari yang terdaftar ditolak; tak mendapat akses data.
- [ ] Akun yang dinonaktifkan ditolak dari semua halaman dan endpoint.

## Kata sandi, OTP dan keamanan
- [ ] SMTP kustom mengirim OTP pemulihan 6 digit dari template `{{ .Token }}`.
- [ ] OTP salah, kedaluwarsa, dipakai dua kali, dan flood diuji.
- [ ] Setelah reset sandi, pengguna dapat login menggunakan sandi baru.
- [ ] Dosen, Admin, Super Admin diminta MFA sebelum tindakan istimewa.
- [ ] RLS setiap tabel dan storage diuji dengan mahasiswa lain.
- [ ] Tidak ada secret dalam repository Git, commit history, console dan file statis.
- [ ] GitHub secret scanning, Dependabot, branch protection, dan backup aktif.

## Akademik
- [ ] Dosen mengunggah foto WebP pada awal sesi dan melihatnya kembali sebagai BAP.
- [ ] Mahasiswa hanya bisa presensi pada sesi LIVE dan sebelum jam berakhir.
- [ ] BAP otomatis terkunci setelah sesi selesai.
- [ ] Mahasiswa dapat mengunggah beberapa berkas, tautan GitHub/Drive, dan mengedit pengumpulan yang diperbolehkan.
- [ ] Revisi menghapus nilai lama yang belum diverifikasi dosen.
- [ ] Dosen bisa menilai pengumpulan peserta kelas yang dia ampu.
- [ ] Bentrok kelas, ruang, dosen, KRS lintas kelas, dan UTS/UAS terblokir.
- [ ] Perhitungan PAP dan CPL lolos perbandingan dengan perhitungan manual.
- [ ] Pengumuman dan notifikasi hanya terkirim ke audiens yang berhak.
- [ ] Cron tidak mengirim notifikasi berulang atas event yang sama.

## Pengujian dan deployment
- [ ] `npm install` dan `npm run check` sukses pada lingkungan terhubung internet.
- [ ] Login di Android, iPhone, tablet, desktop dengan browser modern.
- [ ] Google OAuth redirect URL domain produksi terdaftar.
- [ ] Push dan email berfungsi di domain HTTPS.
- [ ] Vercel environment secret tersedia hanya pada deployment terkait.
- [ ] Monitoring, error tracking dan prosedur pemulihan insiden disiapkan.

**Status saat arsip dibuat:** daftar ini belum bisa ditandai selesai karena tidak ada akses tulis ke akun Supabase/GitHub dan instalasi npm registry tidak tersedia di container pembuat.
