# Audit NEXUS OBE v2.1 — 16 November 2026

## Ringkasan

Audit ini memeriksa implementasi sumber, bukan deployment. **Sumber kode diperluas dan pengujian logika lokal lulus; tidak ada bukti aplikasi berjalan pada Supabase/Vercel nyata.** Semua fitur di bawah mensyaratkan migrasi `002_communication_assignments.sql` dan data KRS.

| Pertanyaan | Perbaikan kode | Batasan teknis |
|---|---|---|
| Pengumuman | `/pengumuman`, RPC `publish_announcement`, target kampus/role/kelas, masa berlaku, disematkan | Belum ada fitur edit/hapus pengumuman |
| Notifikasi seluruh peran | Trigger database menyimpan notifikasi ketika pengumuman/tugas diterbitkan, tenggat berubah, tugas dikumpulkan, dan nilai diberikan. Supabase Realtime + Web Push tambahan | Push memerlukan izin browser, service worker, kunci VAPID, HTTPS; email Resend opsional; tidak menjamin semua perangkat menerima push |
| Tugas mahasiswa | Dosen membuat kategori nilai, instruksi, tenggat, tautan dan materi; mahasiswa membuat draf, mengumpulkan, merevisi; dosen menilai dan melihat berkas | UAT lintas-role belum dilakukan pada Supabase nyata |
| Lampiran dan tautan | File PDF/gambar/Office/ZIP/teks; multi-file, file dapat ditambah/dihapus, private bucket dan URL unduhan singkat; URL GitHub/Drive/Figma/HTTPS | Tidak ada batas **jumlah** tetap, namun **10 MB/file, 200 MB total per pengumpulan atau materi**, link maksimal 200 pada satu pengumpulan; kuota fisik Supabase tetap berlaku. Tidak dapat mengubah ACL file Google Drive pengguna. |
| Revisi nilai | Revisi menghapus nilai tugas lama dan kalkulasi komponen PAP diperbarui; perubahan kategori tugas ditolak setelah ada pengumpulan | Nilai PAP dari tugas adalah rerata tugas yang sudah dinilai, bukan nilai otomatis berdasarkan mesin AI; kehadiran dan ujian tetap perlu input nilai/kehadiran sesuai alur akademik |
| Bentrok jadwal | Database menolak duplikasi waktu ruang, dosen, rombongan, **mahasiswa KRS lintas rombongan**, serta UTS/UAS yang beririsan; trigger baru menolak pendaftaran KRS bentrok; UI memberi pratinjau | UTS/UAS diandaikan 120 menit karena skema PRD tidak menyimpan durasi tiap ujian; tidak ada pengecekan kalender libur |
| Dashboard | Mahasiswa: tugas terbuka/terkumpul/notifikasi + kelas KRS. Dosen: tugas, penilaian tertunda, RPS. Admin: KRS, validasi RPS, jadwal. Super Admin: akun, audit, ringkasan operasional. | Bukan konfirmasi bahwa setiap KPI numerik sudah memenuhi kebutuhan institusi; verifikasi dengan dataset kampus diperlukan. |

## Aturan alur transaksi

- Tugas hanya dapat ditulis dosen pengampu. Pengumpulan hanya untuk mahasiswa KRS pada tugas yang dipublikasikan, sesuai tenggat atau opsi keterlambatan.
- Lampiran disimpan pada bucket privat dan metadata file terlindungi RLS; endpoint menandatangani URL unduhan hanya setelah akses metadata diperiksa.
- Revisi setelah dinilai membatalkan nilai sebelumnya sebelum dinilai ulang; pengumpulan kosong ditolak dan perubahan yang menghapus bukti terakhir kembali menjadi draf. Komponen tugas PAP disinkronkan, termasuk saat dosen menyimpan nilai manual berikutnya.
- Pengumuman kampus atau kelas dikirim sesuai audience (`all`, `mahasiswa`, `dosen`, `admin`, `super_admin`). Notifikasi tercatat di database secara transaksional. Push hanya sidecar, tidak membuat duplikasi baris in-app.
- Jadwal dan pendaftaran KRS menggunakan advisory lock per tahun akademik dalam transaksi PostgreSQL.
- Input tekstual divalidasi Zod dan database; attachment magic byte diperiksa; tautan hanya HTTPS domain publik. Penyimpanan file server memakai service role tanpa membukanya pada client.

## Hasil pemeriksaan lokal

- Transpilasi sintaks TypeScript seluruh `src` dan `tests` (100 file): **lolos, 0 diagnostic sintaks**.
- **12/12 pengujian unit logika lulus** melalui transpiler TypeScript global dan Node test runner (PAP/CPL, tautan, WIB, magic bytes, bentrok mingguan, ujian, peserta KRS lintas rombongan). Jalankan ulang `npm run test` sesudah dependensi terpasang.
- JavaScript pratinjau HTML diperiksa dengan parser `node:vm`.
- Migrasi SQL baru telah ditinjau tekstual, **belum berhasil dieksekusi** pada instance Supabase; sumber migrasi ini harus diuji pada proyek staging dengan data tiruan dan akun keempat peran.
- Lint, typecheck proyek menyeluruh, audit dependensi dan build Next.js **belum terverifikasi** karena registry npm tidak tersedia di lingkungan pembuatan.

## Pengujian penerimaan wajib sebelum produksi

1. Jalankan migrasi `001_initial.sql` kemudian `002_communication_assignments.sql` pada Supabase staging, lalu `seed.sql`. Siapkan 1 akun per role dengan MFA dosen/admin/super admin.
2. Login dosen, buat tugas di kelas yang benar, unggah beberapa materi dan publikasikan. Pastikan peserta KRS menerima notifikasi dan mahasiswa di luar kelas tidak dapat melihatnya.
3. Login mahasiswa, simpan draf, kirim banyak file serta beberapa URL (GitHub dan Drive), lalu kumpulkan. Dosen harus bisa membuka file tetapi mahasiswa lain tidak. Revisi dan hapus file; cek revision dan status nilai kembali kosong.
4. Dosen menilai tugas. Validasi persentase dan nilai akhir PAP terhadap 6 komponen, dan CPL dihitung terpisah tanpa komponen kehadiran.
5. Admin buat dua jadwal dengan bentrok ruang, dosen, kode kelas, atau mahasiswa yang sama melalui KRS; pastikan transaksi ditolak. Ulangi dengan jadwal UTS/UAS 120 menit.
6. Verifikasi pengumuman global dan kelas untuk penerima yang tepat. Coba subscribe push dengan Chrome/Firefox di HTTPS lalu tutup aplikasi; cek audit dan deduplikasi cron dua kali.
7. Uji sesi logout, MFA, RLS, unggah file besar, file magic bytes salah, tautan tidak aman, link privasi, revisi lewat tenggat, dan akses antar-role.
8. Jalankan `npm ci` setelah membuat `package-lock.json`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm audit --audit-level=high`, kemudian staging UAT dan uji beban.

## Operasional yang belum otomatis

Aplikasi **tidak sepenuhnya otomatis**. Nilai tugas tetap diinput dosen, daftar akun/KRS harus dibuat admin, nilai ujian perlu dicatat, Push memerlukan opt-in dan konfigurasi VAPID, penyimpanan dan email memerlukan layanan yang aktif. Pratinjau HTML adalah simulasi lokal, bukan portal yang terhubung ke database. PRD tidak memuat identitas semua peserta sehingga tidak ada akun peserta fiktif.
