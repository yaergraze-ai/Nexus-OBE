# 🎓 NEXUS OBE (v2.0) — Smart Academic & Outcome-Based Education Portal
> **Production-Ready Master Blueprint: Product Requirements Document (PRD), Dual OBE Calculation Engine, OWASP Top 10 Security, Adaptive UI/UX Motion System, & GitHub–Vercel CI/CD Workflow**

---

## 📋 Daftar Isi
1. [Ringkasan Eksekutif & Visi Produk](#1-ringkasan-eksekutif--visi-produk)
2. [Tech Stack & Ekosistem Teknologi](#2-tech-stack--ekosistem-teknologi)
3. [Matriks Peran Pengguna (4-Role RBAC Ecosystem)](#3-matriks-peran-pengguna-4-role-rbac-ecosystem)
4. [Pemetaan Data Kurikulum & Mata Kuliah Riil](#4-pemetaan-data-kurikulum--mata-kuliah-riil)
5. [Mesin Status Otomatis & Dual Kalkulasi Nilai OBE](#5-mesin-status-otomatis--dual-kalkulasi-nilai-obe)
6. [Sistem Notifikasi Hibrida (Online Realtime & Offline Push/Cron)](#6-sistem-notifikasi-hibrida-online-realtime--offline-pushcron)
7. [Arsitektur Keamanan Cyber (Standar OWASP Top 10)](#7-arsitektur-keamanan-cyber-standar-owasp-top-10)
8. [Desain UI/UX, Adaptive Device Engine, & Micro-Animations](#8-desain-uiux-adaptive-device-engine--micro-animations)
9. [Arsitektur Database, Views, & Row Level Security (Supabase)](#9-arsitektur-database-views--row-level-security-supabase)
10. [Struktur Folder Proyek (Next.js App Router + Strict TypeScript)](#10-struktur-folder-proyek-nextjs-app-router--strict-typescript)
11. [Workflow Pengembangan, GitHub Repository, & Deployment Vercel](#11-workflow-pengembangan-github-repository--deployment-vercel)
12. [Roadmap Implementasi & Checklist Kualitas Produksi](#12-roadmap-implementasi--checklist-射kualitas-produksi)

---

## 1. Ringkasan Eksekutif & Visi Produk

### 1.1 Identitas Platform
* **Nama Platform:** **NEXUS OBE** *(Outcome-Based Education & Smart E-Class Portal)*
* **Target Institusi:** Perguruan Tinggi / Fakultas Teknik (Program Studi Teknik Informatika) — Tahun Akademik Aktif `2026/2027 Ganjil`.
* **Visi Utama:** Menghadirkan portal akademik terpadu tanpa fitur mati (*zero dead features*), di mana jadwal perkuliahan, presensi langsung (*live check-in*), Berita Acara Perkuliahan (BAP) berfoto, validasi Rencana Pembelajaran Semester (RPS), hingga penghitungan otomatis nilai akhir dan ketuntasan CPL saling terhubung secara *real-time*, aman sesuai standar **OWASP Top 10**, serta adaptif di seluruh perangkat.

### 1.2 Peningkatan Arsitektur Versi 2.0
1. **RPS Validation State Machine:** Mengunci pembukaan sesi pertemuan secara otomatis jika status `Validasi RPS` masih `Belum` (seperti pada kasus kelas *Manajemen Proyek Teknologi Informasi TI24D*), disertai notifikasi pengingat otomatis ke Dosen dan Kaprodi/Admin.
2. **Dual Calculation Engine:** Memisahkan secara matematis antara **Nilai Akhir Mahasiswa (Skala PAP `A`–`E` berbasis 6 komponen termasuk Kehadiran $10\%$)** dengan **Matriks Ketuntasan CPL/Sub-CPMK (berbasis evaluasi `UTS`, `UAS`, `#A`, `#B`, `#C`)**.
3. **Hybrid Online/Offline Notification:** Menggabungkan *Supabase Realtime* (saat aplikasi terbuka) dengan *Web Push API + Vercel Cron Jobs* (saat aplikasi tertutup/offline) untuk pengingat jadwal masuk kuliah, pengisian jadwal UTS/UAS baru, serta pembukaan sesi kelas.
4. **Client-Side WebP Compression & BAP Locking:** Kompresi foto dokumentasi kelas (tatap muka maupun tangkapan layar daring) otomatis menjadi `.webp` ($\le 500\text{ KB}$) sebelum diunggah, serta penguncian Berita Acara Pertemuan otomatis setelah jam selesai terlewati.

---

## 2. Tech Stack & Ekosistem Teknologi

| Lapisan Teknologi | Pilihan Teknologi | Peran & Alasan Pemilihan |
| :--- | :--- | :--- |
| **Core Framework** | **Next.js 15+ (App Router)** | Server-Side Rendering (SSR), Server Actions, Edge Middleware untuk proteksi rute berbasis role, serta optimasi performa otomatis. |
| **Bahasa Pemrograman** | **100% Strict TypeScript (`.ts`/`.tsx`) + Modular JS** | Keamanan tipe data (*type-safety*) menyeluruh dari skema database hingga komponen UI untuk mencegah *runtime error*, ditambah skrip Service Worker (`sw.js`) untuk *background push*. |
| **UI Library** | **React 19** | Arsitektur Server & Client Components yang efisien untuk kecepatan muat awal (*First Contentful Paint*) dan interaktivitas langsung. |
| **Styling & Layout** | **Tailwind CSS v4** | Utility-first CSS dengan *design tokens* akademik kustom, responsif penuh di semua ukuran layar. |
| **Ikonografi** | **Bootstrap Icons 5 (`bootstrap-icons`)** | Paket ikon resmi `bi-*` yang tajam, konsisten, dan ringan untuk seluruh navigasi, kartu status, dan tombol aksi. |
| **Animasi & Transisi** | **Framer Motion (`LazyMotion`) + GPU CSS** | Transisi perpindahan halaman halus dan mikro-interaksi tombol (*spring physics*) di $60\text{ FPS}$ dengan dukungan aksesibilitas `prefers-reduced-motion`. |
| **Backend & Database** | **Supabase (PostgreSQL + Auth + Realtime + Storage)** | Database relasional kuat, autentikasi aman, WebSocket *real-time* untuk notifikasi & absensi langsung, serta penyimpanan foto dokumentasi kelas. |
| **Validasi & Keamanan** | **Zod + ISOMorphic DOMPurify + OWASP Headers** | Validasi skema input ketat di klien dan server serta perlindungan menyeluruh terhadap celah keamanan web modern. |
| **Version Control** | **GitHub Repository + GitHub Actions** | Manajemen *branch*, *automated linting*, *strict type-checking*, dan audit kerentanan dependensi sebelum *merge*. |
| **Hosting & Cron** | **Vercel (Edge Network + Vercel Cron)** | Deployment otomatis dari GitHub dengan TLS 1.3, CDN global, dan penjadwal otomatis untuk pengingat jadwal masuk kuliah. |

---

## 3. Matriks Peran Pengguna (4-Role RBAC Ecosystem)

Setiap peran memiliki ruang kerja terdedikasi yang terhubung otomatis satu sama lain:

### 3.1 Mahasiswa (Contoh Akun: `KANA NURHANA` — NIM `240511088`)
* **Dashboard Akademik Personal:** Menampilkan jadwal kuliah hari ini, hitung mundur menuju kelas berikutnya, kartu siaran langsung (*Live Class Banner*) saat dosen membuka pertemuan, serta ringkasan ketuntasan SKS dan IPS.
* **Kelas Kuliah & Riwayat Pertemuan:** Mengakses daftar seluruh mata kuliah pada semester `2026/2027 Ganjil`, informasi ruang (`G. Mahdar R. D 403`, dll.), jadwal UTS/UAS, persentase bobot nilai, standar PAP, serta kartu riwayat pertemuan lengkap dengan foto dokumentasi kelas.
* **Smart Self Check-In:** Tombol absensi mandiri otomatis aktif saat Dosen membuka sesi kelas dan mengirimkan notifikasi *"Kelas Dimulai"*, lalu otomatis terkunci saat sesi ditutup.
* **Eksplorasi RPS & E-Raport OBE:** Melihat target kelulusan (`2.75`), pemetaan `CPL -> CPMK -> Sub-CPMK`, matriks evaluasi (`UTS`, `UAS`, `#A`, `#B`, `#C`), serta E-Raport nilai akhir otomatis.

### 3.2 Dosen (Contoh Akun: `MUHAMAD IMAM` — NIDN `0413088807`)
* **Live Class & BAP Controller:** Membuka pertemuan baru (`Pertemuan ke-#N`), mencatat jam mulai & selesai, memilih jenis pertemuan (`KULIAH`, `PRAKTIKUM`, `PENGGANTI`), mengisi ringkasan materi, dan mengunggah foto bukti kelas (otomatis terkompresi ke `.webp`).
* **Pemicu Notifikasi & Presensi Instan:** Menekan tombol **"Mulai Pertemuan"** akan langsung mengirim notifikasi ke seluruh mahasiswa peserta kelas dan membuka akses absensi mandiri.
* **Penyusunan & Pengajuan RPS OBE:** Menyusun CPL, CPMK, Sub-CPMK, dan distribusi bobot hingga total tepat $100\%$, lalu mengajukan validasi ke Kaprodi/Admin.
* **Input Nilai Komponen:** Mengisi nilai Kehadiran, UTS, UAS, Tugas Harian, Tugas Kelompok, dan Tugas Besar. Sistem langsung menghitung nilai akhir dan predikat huruf mahasiswa.

### 3.3 Admin Akademik (Kaprodi / Dekan / Staf Tata Usaha)
* **Conflict-Free Schedule & Exam Manager:** Mengatur jadwal kuliah mingguan, ruang kelas, serta jadwal `UTS` dan `UAS` dengan deteksi bentrok otomatis (ruang atau dosen di jam beririsan) dan pengiriman notifikasi jadwal masuk otomatis ke Dosen & Mahasiswa.
* **Otorisasi Validasi RPS:** Melakukan tindakan **`Validasi Kaprodi`** dan **`Validasi Dekan`**. Begitu kedua validasi disetujui, status kelas berubah dari `Validasi RPS: Belum` menjadi `Sudah` dan membuka akses pertemuan bagi Dosen.
* **Manajemen Master Data & Periode PBM:** Mengelola data Mahasiswa, Dosen, Kelas (`TI24D`, `TI25D`, `24K2B`), peserta KRS, status `Periode PBM (on/off)`, serta pembukaan ulang kunci BAP apabila terjadi kesalahan input dosen.

### 3.4 Super Admin (System Architect & Security Officer)
* **RBAC & User Governance:** Membuat akun, menetapkan/mengubah role (`mahasiswa`, `dosen`, `admin`, `super_admin`), mengatur kebijakan MFA, dan mencabut sesi aktif jika terdeteksi anomali.
* **Immutable Security Audit Logs:** Memantau log seluruh aktivitas kritis (percobaan login gagal, perubahan nilai, validasi RPS, perubahan jadwal, pembukaan kunci BAP) beserta alamat IP dan *timestamp*.
* **Global System & PAP Configuration:** Mengatur Tahun Akademik aktif (`2026/2027 Ganjil`), ambang batas Penilaian Acuan Patokan (PAP), dan pemantauan kesehatan integrasi Supabase & Vercel Cron.

---

## 4. Pemetaan Data Kurikulum & Mata Kuliah Riil

Data di bawah ini merupakan struktur kurikulum semester `2026/2027 Ganjil` Fakultas Teknik — Program Studi Teknik Informatika yang menjadi *seed data* utama sistem:

### 4.1 Daftar 8 Kelas Perkuliahan Terintegrasi
| No | Kode & Nama Mata Kuliah | Kelas | SKS | Dosen Pengampu (NIDN/Kode) | Jadwal & Ruangan | Status RPS & Pertemuan | Sasaran |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| 1 | **TIF-313 — Interaksi Manusia & Komputer** *(Human-Computer Interaction)* | `TI25D` | $3.00$ | `0413088807` **MUHAMAD IMAM** | **Senin**, 10:30 – 13:00<br>`G. Mahdar R. D 403` | Validasi: **Sudah** (Kaprodi & Dekan)<br>RPS: 16 \| Peserta: 30 \| Terlaksana: 2 | `2.75 / 3.00` |
| 2 | **Analisis dan Design PL** | `TI24D` | $3.00$ | `0431117105` **DIAN NOVIANTI** | **Senin**, 13:00 – 15:30<br>`G. Mahdar R. D 406` | Validasi: **Sudah**<br>RPS: 16 \| Peserta: 30 \| Terlaksana: 3 | `2.75 / 3.00` |
| 3 | **Pemrograman Berbasis Platform** | `TI24D` | $3.00$ | `0404067806` **SUDIYANTO** | **Senin**, 10:00 – 12:30<br>`G. Mahdar R. D 406` | Validasi: **Sudah**<br>RPS: 16 \| Peserta: 30 \| Terlaksana: 3 | `2.75 / 3.00` |
| 4 | **Tata Tulis Ilmiah (Metodologi Penelitian)** | `TI24D` | $2.00$ | `0405118304` **HARRY GUNAWAN** | **Selasa**, 07:30 – 09:10<br>`G. Mahdar R. D 405` | Validasi: **Sudah**<br>RPS: 7 \| Peserta: 30 \| Terlaksana: 2 | `2.75 / 3.00` |
| 5 | **Manajemen Proyek Teknologi Informasi** | `TI24D` | $3.00$ | `7157750651130113` **GUNADI DWI HANTORO** | **Senin**, 07:30 – 10:00<br>`G. Mahdar R. D 406` | Validasi: **Belum** *(Terkunci)*<br>RPS: 0 \| Peserta: 30 \| Terlaksana: 0 | `0.00 / 3.00` |
| 6 | **AIK 4 (Islam dan Ilmu Pengetahuan)** | `TI24D` | $2.00$ | `0043761662131163` **MASDUM MUSTAQWA** | **Kamis**, 10:00 – 11:40<br>`G. Mahdar R. D 405` | Validasi: **Sudah**<br>RPS: 16 \| Peserta: 26 \| Terlaksana: 3 | `3.00 / 3.00` |
| 7 | **AI Computing Platform** | `24K2B` | $3.00$ | `0402087307` **FREDDY WICAKSONO** | **Rabu**, 19:00 – 22:00<br>`G. Mahdar R. C 303` | Validasi: **Sudah**<br>RPS: 16 \| Peserta: 11 \| Terlaksana: 2 | `2.00 / 3.00` |
| 8 | **Teknologi AR/VR** | `24K2B` | $3.00$ | `0413088807` **MUHAMAD IMAM** | **Selasa**, 13:00 – 15:30<br>`G. Mahdar R. D 405` | Validasi: **Sudah**<br>RPS: 16 \| Peserta: 31 \| Terlaksana: 2 | `2.75 / 3.00` |

### 4.2 Struktur Kurikulum OBE (`TIF-313 Interaksi Manusia & Komputer`)
1. **CPL-PRODI yang Dibebankan pada MK:**
   * `CPL04` *(Bobot $38\%$)*: Mampu merancang, mengembangkan, dan mengimplementasikan sistem perangkat lunak dan infrastruktur TI yang andal, aman, dan skalabel.
   * `CPL08` *(Bobot $62\%$)*: Mampu berkomunikasi secara efektif dalam bahasa Indonesia dan bahasa asing, serta berkolaborasi lintas disiplin.
2. **Capaian Pembelajaran Mata Kuliah (CPMK):**
   * `CPMK 1` *(Bobot $38\% \rightarrow \text{CPL04}$)*: Mampu menganalisis prinsip IMK, faktor manusia, serta merancang arsitektur antarmuka pengguna (UI/UX) yang andal, aman, skalabel, dan ramah pengguna (*User-Centered Design*).
   * `CPMK 2` *(Bobot $62\% \rightarrow \text{CPL08}$)*: Mampu membangun prototipe interaktif, melakukan pengujian keusabilitas (*Usability Testing*), serta mempresentasikan dan mendokumentasikan hasil rancangan antarmuka secara efektif dalam tim kolaboratif.
3. **Kemampuan Akhir Tiap Tahapan Belajar (Sub-CPMK) & Matriks Evaluasi:**
   * `Sub-CPMK 1` ($11\%$): Konsep dasar IMK, faktor manusia, ragam dialog, prinsip usability $\rightarrow$ `UTS: 8`, `#A: 3`
   * `Sub-CPMK 2` ($19\%$): Metodologi UCD / Design Thinking, User Persona, Customer Journey Map $\rightarrow$ `UTS: 12`, `#A: 3`, `#C: 4`
   * `Sub-CPMK 3` ($8\%$): Information Architecture, Design System, Low-Fidelity Wireframe $\rightarrow$ `#A: 3`, `#B: 5`
   * `Sub-CPMK 4` ($19\%$): High-Fidelity Interactive Prototype $\rightarrow$ `#B: 15`, `#C: 4`
   * `Sub-CPMK 5` ($25\%$): Usability Testing / Heuristic Evaluation & pengolahan data $\rightarrow$ `UAS: 10`, `#A: 3`, `#B: 5`, `#C: 7`
   * `Sub-CPMK 6` ($18\%$): Dokumen spesifikasi desain & presentasi kolaboratif $\rightarrow$ `UAS: 10`, `#A: 3`, `#B: 5`

---

## 5. Mesin Status Otomatis & Dual Kalkulasi Nilai OBE

### 5.1 RPS Validation State Machine
Untuk mencegah perkuliahan berjalan tanpa kurikulum tervalidasi (seperti kondisi awal pada *Manajemen Proyek Teknologi Informasi TI24D*), siklus hidup RPS dikontrol secara ketat oleh sistem:

```text
[DRAFT_DOSEN] ──(Bobot CPL/CPMK = 100%)──► [SUBMITTED_REVIEW]
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
        [VALIDATED_KAPRODI]                                               [VALIDATED_DEKAN]
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  ▼
                         [RPS_ACTIVE: Validasi RPS = "Sudah"]
                         └──► Membuka Tombol "Mulai Pertemuan" bagi Dosen
```

* Selama status belum mencapai `RPS_ACTIVE`, tombol **Mulai Pertemuan** pada dashboard Dosen otomatis berstatus *disabled* dengan *tooltip* informatif: *"Menunggu Validasi Kaprodi & Dekan"*, dan sistem mengirim notifikasi pengingat otomatis setiap hari kerja pukul 08:00 WIB.

### 5.2 Siklus Hidup Pertemuan & Penguncian Berita Acara (BAP)
1. **`LIVE` (Sesi Aktif):** Dimulai saat Dosen menekan **"Mulai Pertemuan"** dan mengunggah foto bukti kelas (tatap muka atau *screenshot* pertemuan daring). Mahasiswa menerima notifikasi instan dan dapat menekan **"Absen Sekarang"**.
2. **`COMPLETED_LOCKED` (Sesi Terkunci):** Terjadi otomatis ketika Dosen menekan **"Selesai Pertemuan"** atau saat waktu melewati `Jam Selesai` jadwal kuliah. Setelah terkunci, daftar hadir dan ringkasan materi tidak dapat dimanipulasi sembarangan (hanya dapat dibuka kembali melalui permintaan *override* ke Admin yang tercatat di `audit_logs`).

### 5.3 Dual Grading & OBE Attainment Engine
Sistem memisahkan perhitungan **Nilai Akhir Mahasiswa (untuk E-Raport)** dan **Ketuntasan Capaian Pembelajaran (untuk Evaluasi OBE)** agar tidak terjadi selisih bobot:

#### A. Rumus Nilai Akhir Mahasiswa (Skala PAP 6 Komponen)
Nilai akhir numerik mahasiswa ($N_{\text{akhir}}$) dihitung otomatis dari enam komponen evaluasi perkuliahan:

$$N_{\text{akhir}} = (0.10 \times S_{\text{hadir}}) + (0.20 \times S_{\text{UTS}}) + (0.20 \times S_{\text{UAS}}) + (0.20 \times S_{\text{harian}}) + (0.20 \times S_{\text{kelompok}}) + (0.10 \times S_{\text{besar}})$$

Konversi otomatis ke **Penilaian Acuan Patokan (PAP)**:
* $85 \le N_{\text{akhir}} \le 100 \rightarrow$ **A** (Mutu $4.00$ — *Sangat Baik*)
* $70 \le N_{\text{akhir}} \le 84 \rightarrow$ **B** (Mutu $3.00$ — *Baik*)
* $55 \le N_{\text{akhir}} \le 69 \rightarrow$ **C** (Mutu $2.00$ — *Cukup*)
* $40 \le N_{\text{akhir}} \le 54 \rightarrow$ **D** (Mutu $1.00$ — *Kurang*)
* $0 \le N_{\text{akhir}} \le 39 \rightarrow$ **E** (Mutu $0.00$ — *Gagal*)

Mahasiswa dinyatakan **Tuntas Mata Kuliah** apabila nilai mutu $\ge$ **Sasaran Ketuntasan** kelas (contoh: $\ge 2.75$ untuk *Interaksi Manusia & Komputer*, atau $\ge 3.00$ untuk *AIK 4*).

#### B. Rumus Ketuntasan CPL / Sub-CPMK (Matriks RPS Tanpa Kehadiran)
Untuk evaluasi kurikulum OBE, tingkat ketercapaian tiap $\text{CPL}_k$ ($K_{\text{CPL}_k}$) dihitung dari pemetaan bobot Sub-CPMK terhadap instrumen asesmen (`UTS`, `UAS`, `#A` = Tugas Harian, `#B` = Tugas Kelompok, `#C` = Tugas Besar):

$$K_{\text{CPL}_k} = \frac{\sum_{i \in \text{CPL}_k} \left( w_{i,\text{UTS}} S_{\text{UTS}} + w_{i,\text{UAS}} S_{\text{UAS}} + w_{i,\#A} S_{\text{harian}} + w_{i,\#B} S_{\text{kelompok}} + w_{i,\#C} S_{\text{besar}} \right)}{\sum_{i \in \text{CPL}_k} W_i}$$

dengan total bobot matriks evaluasi pada RPS selalu memenuhi $\sum W_i = 100$.

---

## 6. Sistem Notifikasi Hibrida (Online Realtime & Offline Push/Cron)

Agar pengingat jadwal masuk kuliah tetap diterima Dosen maupun Mahasiswa meskipun aplikasi tidak sedang dibuka di browser, sistem menerapkan **arsitektur notifikasi hibrida 3-jalur**:

| Event Pemicu | Waktu Eksekusi | Penerima | Jalur Pengiriman |
| :--- | :--- | :--- | :--- |
| `SCHEDULE_CREATED_OR_UPDATED` | Instan saat Admin menyimpan jadwal kuliah / ruang baru. | Dosen & Mahasiswa Kelas | In-App Realtime + Web Push + Email |
| `EXAM_SCHEDULE_PUBLISHED` | Instan saat Admin mengisi kolom `Jadwal UTS` atau `Jadwal UAS` yang sebelumnya kosong. | Dosen & Mahasiswa Kelas | In-App Realtime + Web Push + Email |
| `CLASS_REMINDER_H30` | Tepat **30 menit sebelum** `start_time` jadwal kuliah (`Vercel Cron`). | Dosen & Mahasiswa Kelas | In-App Bell + Web Push Notification |
| `CLASS_REMINDER_H10` | Tepat **10 menit sebelum** `start_time` jadwal kuliah (`Vercel Cron`). | Dosen & Mahasiswa Kelas | In-App Bell + Web Push Notification |
| `LIVE_SESSION_STARTED` | Instan saat Dosen menekan tombol **"Mulai Pertemuan"**. | Seluruh Mahasiswa Kelas | **Supabase Realtime Toast + Audio Cue + Web Push** |
| `RPS_VALIDATION_REQUIRED` | Harian (08:00 WIB) untuk kelas dengan status `Validasi RPS: Belum`. | Dosen Pengampu & Admin | In-App Bell + Email Pengingat |

### Mekanisme Anti-Duplikasi (*Idempotency*)
Setiap pengiriman notifikasi terjadwal dari `Vercel Cron` mencatat kunci unik `idempotency_key` (format: `reminder:{class_id}:{date}:H30`) pada tabel `notification_dispatch_logs` sehingga pengguna tidak pernah menerima notifikasi ganda.

---

## 7. Arsitektur Keamanan Cyber (Standar OWASP Top 10)

Seluruh lapisan aplikasi dirancang mengikuti pedoman **OWASP Top 10**:

| Kategori OWASP Top 10 | Implementasi Teknis di NEXUS OBE |
| :--- | :--- |
| **A01: Broken Access Control** | • **Supabase Row Level Security (RLS)** di $100\%$ tabel.<br>• **Edge Middleware (`src/middleware.ts`)** memverifikasi sesi dan role di setiap permintaan rute.<br>• Penggunaan **UUID v4** untuk mencegah enumerasi ID (*IDOR*). |
| **A02: Cryptographic Failures** | • Enkripsi transport wajib **HTTPS / TLS 1.3** dengan header `Strict-Transport-Security`.<br>• Hashing kata sandi menggunakan **Argon2id / Bcrypt** melalui Supabase Auth.<br>• Pemisahan ketat variabel server (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) dari bundel klien. |
| **A03: Injection** | • Seluruh kueri menggunakan **Parameterized Queries** via Supabase SDK.<br>• Validasi skema input ketat di sisi klien & server dengan **Zod**.<br>• Sanitasi teks ringkasan materi menggunakan **ISOMorphic DOMPurify** untuk mencegah *Stored XSS*. |
| **A04: Insecure Design** | • Validasi aturan bisnis di server: absensi mandiri ditolak jika status pertemuan bukan `LIVE`; total bobot RPS wajib $100\%$; penguncian otomatis BAP setelah jam selesai. |
| **A05: Security Misconfiguration** | • Penerapan **HTTP Security Headers** di `next.config.ts`: `Content-Security-Policy (CSP)`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy`. |
| **A06: Vulnerable & Outdated Components** | • **GitHub Dependabot** aktif dan pipeline CI menjalankan `npm audit --audit-level=high` pada setiap *Pull Request*. |
| **A07: Identification & Authentication Failures** | • Form login dilengkapi **Rate Limiting** (maksimal $5$ percobaan gagal dalam $15$ menit per IP/akun).<br>• Penyimpanan sesi pada **`HttpOnly`, `Secure`, `SameSite=Lax` Cookies** melalui `@supabase/ssr`.<br>• Dukungan **TOTP Multi-Factor Authentication (MFA)** untuk Dosen, Admin, dan Super Admin. |
| **A08: Software & Data Integrity Failures** | • Validasi *magic bytes* dan tipe MIME pada **Supabase Storage** (hanya menerima `.webp`, `.jpg`, `.png` maks $5\text{ MB}$ setelah kompresi).<br>• *Branch protection* pada `main` di GitHub mewajibkan lolos seluruh pengecekan CI. |
| **A09: Security Logging & Monitoring Failures** | • **PostgreSQL Triggers** otomatis merekam perubahan nilai, validasi RPS, pembukaan kunci BAP, dan perubahan role ke tabel `audit_logs` yang bersifat *append-only* (`NO UPDATE / NO DELETE`). |
| **A10: Server-Side Request Forgery (SSRF)** | • Validasi ketat daftar domain yang diizinkan (*allowlist*) untuk tautan eksternal dan pemblokiran rentang IP privat/internal pada server. |

---

## 8. Desain UI/UX, Adaptive Device Engine, & Micro-Animations

### 8.1 Identitas Visual & Bootstrap 5 Icons
* **Palet Warna Modern Academic:**
  * *Primary Crimson:* `#8B0000` (Header & aksen identitas kampus) dengan gradasi lembut `#991B1B`.
  * *Surface & Canvas:* `#F8FAFC` (*Cool Slate*) dengan kartu putih bersih `#FFFFFF`, border halus `#E2E8F0`, dan bayangan lembut.
  * *Interactive Accent:* `#0284C7` (Tab aktif, tombol lihat raport/RPS) dan `#16A34A` (Badge hijau `Validasi Kaprodi` & `Validasi Dekan`).
* **Ikonografi Bootstrap Icons (`bootstrap-icons`):**
  * Seluruh ikon menggunakan kelas resmi Bootstrap 5 (`<i className="bi bi-..." />`):
    * Dashboard: `bi-house-door-fill`
    * Kelas Kuliah: `bi-journal-bookmark-fill`
    * Jadwal & Jam: `bi-calendar3`, `bi-clock-fill`
    * Notifikasi: `bi-bell-fill`
    * Validasi RPS: `bi-patch-check-fill`
    * Sesi Live / Presensi: `bi-broadcast`, `bi-person-check-fill`
    * Dokumentasi Foto: `bi-camera-fill`
    * Keamanan & Audit: `bi-shield-lock-fill`, `bi-file-earmark-lock2-fill`

### 8.2 Adaptive Device Engine (`useDeviceAdaptive`)
Antarmuka otomatis menyesuaikan struktur tata letak berdasarkan ukuran layar dan kemampuan perangkat pengguna:
1. **Smartphone ($< 768\text{ px}$):**
   * Sidebar kiri bertransformasi otomatis menjadi **Fixed Bottom Navigation Bar** (maksimal 4 menu utama + drawer profil) agar mudah dijangkau satu tangan.
   * Tabel matriks RPS dan tabel nilai PAP otomatis berubah menjadi *Horizontal Swipeable Cards* dengan indikator gulir.
2. **Tablet ($768\text{ px} - 1024\text{ px}$):**
   * Sidebar berubah menjadi *Collapsible Icon Rail* ($72\text{ px}$) dengan tata letak kartu 2 kolom.
3. **Desktop ($> 1024\text{ px}$):**
   * Sidebar penuh di kiri ($250\text{ px}$), *Sticky Top Bar* berisi Tahun Akademik & jam *real-time* WIB, serta grid kartu 3–4 kolom.

### 8.3 Sistem Animasi Ringan ($60\text{ FPS}$) & Aksesibilitas
* **Hardware-Accelerated Only:** Animasi hanya memodifikasi properti komposit GPU (`transform` dan `opacity`) menggunakan `LazyMotion` agar *bundle* tetap ringan dan hemat baterai.
* **Transisi Perpindahan Halaman (`app/template.tsx`):** Transisi *fade + subtle slide* (`opacity: 0 -> 1`, `y: 6px -> 0px`, durasi `200ms`, kurva `easeOut`).
* **Mikro-Interaksi Tombol (`AnimatedButton`):** Efek elevasi halus saat *hover* dan pantulan pegas taktil saat ditekan (`scale: 0.97`, `stiffness: 500`, `damping: 30`).
* **Aksesibilitas Gerak:** Mematuhi pengaturan sistem `@media (prefers-reduced-motion: reduce)` secara otomatis.

---

## 9. Arsitektur Database, Views, & Row Level Security (Supabase)

Skema PostgreSQL berikut mencakup seluruh tabel, *computed columns*, *database views* untuk pemisahan rumus PAP vs. CPL, serta kebijakan RLS:

```sql
-- 1. Ekstensi & Tipe Enumerasi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('mahasiswa', 'dosen', 'admin', 'super_admin');
CREATE TYPE meeting_type AS ENUM ('KULIAH', 'PRAKTIKUM', 'UTS', 'UAS', 'PENGGANTI');
CREATE TYPE attendance_status AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALPHA');
CREATE TYPE session_state AS ENUM ('LIVE', 'COMPLETED_LOCKED');
CREATE TYPE pbm_status AS ENUM ('on', 'off');

-- 2. Profil Pengguna (Terhubung ke auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_number VARCHAR(30) UNIQUE NOT NULL, -- NIM atau NIDN
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'mahasiswa',
    faculty VARCHAR(100) DEFAULT 'FAKULTAS TEKNIK',
    study_program VARCHAR(100) DEFAULT 'Teknik Informatika',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Master Mata Kuliah
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code VARCHAR(20) UNIQUE NOT NULL, -- TIF-313
    name_id VARCHAR(150) NOT NULL,
    name_en VARCHAR(150),
    sks_total NUMERIC(3,1) NOT NULL DEFAULT 3.0,
    sks_theory NUMERIC(3,1) NOT NULL DEFAULT 3.0,
    sks_practicum NUMERIC(3,1) NOT NULL DEFAULT 0.0,
    sks_field NUMERIC(3,1) NOT NULL DEFAULT 0.0,
    course_type CHAR(1) DEFAULT 'A',
    passing_grade_target NUMERIC(3,2) NOT NULL DEFAULT 2.75,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Kelas Perkuliahan Semester Aktif
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year VARCHAR(30) NOT NULL DEFAULT '2026/2027 Ganjil',
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    lecturer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    class_code VARCHAR(20) NOT NULL, -- TI25D, TI24D, 24K2B
    schedule_day VARCHAR(15) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    uts_schedule TIMESTAMPTZ,
    uas_schedule TIMESTAMPTZ,
    pbm_period pbm_status NOT NULL DEFAULT 'on',
    rps_validated_kaprodi BOOLEAN NOT NULL DEFAULT FALSE,
    rps_validated_dekan BOOLEAN NOT NULL DEFAULT FALSE,
    rps_target_meetings INT NOT NULL DEFAULT 16,
    weight_attendance INT NOT NULL DEFAULT 10,
    weight_uts INT NOT NULL DEFAULT 20,
    weight_uas INT NOT NULL DEFAULT 20,
    weight_daily_task INT NOT NULL DEFAULT 20,
    weight_group_task INT NOT NULL DEFAULT 20,
    weight_major_project INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_total_weight CHECK (
        weight_attendance + weight_uts + weight_uas +
        weight_daily_task + weight_group_task + weight_major_project = 100
    )
);

-- 5. Peserta Kelas (KRS)
CREATE TABLE public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- 6. Riwayat Pertemuan & Berita Acara Perkuliahan (BAP)
CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    meeting_number INT NOT NULL,
    meeting_day VARCHAR(15) NOT NULL,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type meeting_type NOT NULL DEFAULT 'KULIAH',
    actual_start_time TIME NOT NULL DEFAULT CURRENT_TIME,
    actual_end_time TIME,
    summary TEXT NOT NULL,
    documentation_photo_url TEXT,
    status session_state NOT NULL DEFAULT 'LIVE',
    unlocked_by_admin_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, meeting_number)
);

-- 7. Presensi Mahasiswa
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'HADIR',
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meeting_id, student_id)
);

-- 8. Kurikulum RPS (CPL, CPMK, Sub-CPMK)
CREATE TABLE public.rps_cpl (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    code VARCHAR(15) NOT NULL,
    description TEXT NOT NULL,
    weight INT NOT NULL
);

CREATE TABLE public.rps_cpmk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    cpl_id UUID REFERENCES public.rps_cpl(id) ON DELETE SET NULL,
    code VARCHAR(15) NOT NULL,
    description TEXT NOT NULL,
    weight INT NOT NULL
);

CREATE TABLE public.rps_sub_cpmk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    cpmk_id UUID REFERENCES public.rps_cpmk(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    weight INT NOT NULL,
    weight_uts INT DEFAULT 0,
    weight_uas INT DEFAULT 0,
    weight_a INT DEFAULT 0,
    weight_b INT DEFAULT 0,
    weight_c INT DEFAULT 0
);

-- 9. Tabel Nilai Mentah Komponen Mahasiswa
CREATE TABLE public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score_attendance NUMERIC(5,2) DEFAULT 0 CHECK (score_attendance BETWEEN 0 AND 100),
    score_uts NUMERIC(5,2) DEFAULT 0 CHECK (score_uts BETWEEN 0 AND 100),
    score_uas NUMERIC(5,2) DEFAULT 0 CHECK (score_uas BETWEEN 0 AND 100),
    score_daily_task NUMERIC(5,2) DEFAULT 0 CHECK (score_daily_task BETWEEN 0 AND 100),
    score_group_task NUMERIC(5,2) DEFAULT 0 CHECK (score_group_task BETWEEN 0 AND 100),
    score_major_project NUMERIC(5,2) DEFAULT 0 CHECK (score_major_project BETWEEN 0 AND 100),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- 10. VIEW 1: Kalkulasi Nilai Akhir Mahasiswa & Grade PAP (Untuk E-Raport)
CREATE OR REPLACE VIEW public.vw_student_final_grades AS
SELECT
    g.id AS grade_id,
    g.class_id,
    g.student_id,
    ROUND(
        (g.score_attendance * (c.weight_attendance / 100.0)) +
        (g.score_uts * (c.weight_uts / 100.0)) +
        (g.score_uas * (c.weight_uas / 100.0)) +
        (g.score_daily_task * (c.weight_daily_task / 100.0)) +
        (g.score_group_task * (c.weight_group_task / 100.0)) +
        (g.score_major_project * (c.weight_major_project / 100.0)), 2
    ) AS final_numeric_score,
    CASE
        WHEN ROUND((g.score_attendance * (c.weight_attendance / 100.0)) + (g.score_uts * (c.weight_uts / 100.0)) + (g.score_uas * (c.weight_uas / 100.0)) + (g.score_daily_task * (c.weight_daily_task / 100.0)) + (g.score_group_task * (c.weight_group_task / 100.0)) + (g.score_major_project * (c.weight_major_project / 100.0)), 2) >= 85 THEN 'A'
        WHEN ROUND((g.score_attendance * (c.weight_attendance / 100.0)) + (g.score_uts * (c.weight_uts / 100.0)) + (g.score_uas * (c.weight_uas / 100.0)) + (g.score_daily_task * (c.weight_daily_task / 100.0)) + (g.score_group_task * (c.weight_group_task / 100.0)) + (g.score_major_project * (c.weight_major_project / 100.0)), 2) >= 70 THEN 'B'
        WHEN ROUND((g.score_attendance * (c.weight_attendance / 100.0)) + (g.score_uts * (c.weight_uts / 100.0)) + (g.score_uas * (c.weight_uas / 100.0)) + (g.score_daily_task * (c.weight_daily_task / 100.0)) + (g.score_group_task * (c.weight_group_task / 100.0)) + (g.score_major_project * (c.weight_major_project / 100.0)), 2) >= 55 THEN 'C'
        WHEN ROUND((g.score_attendance * (c.weight_attendance / 100.0)) + (g.score_uts * (c.weight_uts / 100.0)) + (g.score_uas * (c.weight_uas / 100.0)) + (g.score_daily_task * (c.weight_daily_task / 100.0)) + (g.score_group_task * (c.weight_group_task / 100.0)) + (g.score_major_project * (c.weight_major_project / 100.0)), 2) >= 40 THEN 'D'
        ELSE 'E'
    END AS letter_grade
FROM public.grades g
JOIN public.classes c ON c.id = g.class_id;

-- 11. Tabel Notifikasi, Push Subscriptions & Immutable Audit Logs
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(30) NOT NULL, -- 'SCHEDULE', 'EXAM', 'LIVE_CLASS', 'RPS', 'GRADE'
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notification_dispatch_logs (
    idempotency_key VARCHAR(150) PRIMARY KEY,
    dispatched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Trigger Keamanan: Cegah Dosen Membuka Pertemuan Jika RPS Belum Valid
CREATE OR REPLACE FUNCTION public.enforce_rps_validated_before_meeting()
RETURNS TRIGGER AS $$
DECLARE
    v_kaprodi BOOLEAN;
    v_dekan BOOLEAN;
    v_pbm pbm_status;
BEGIN
    SELECT rps_validated_kaprodi, rps_validated_dekan, pbm_period
    INTO v_kaprodi, v_dekan, v_pbm
    FROM public.classes WHERE id = NEW.class_id;

    IF v_pbm <> 'on' THEN
        RAISE EXCEPTION 'Periode PBM untuk kelas ini sedang nonaktif (off).';
    END IF;

    IF NOT (v_kaprodi AND v_dekan) THEN
        RAISE EXCEPTION 'Pertemuan tidak dapat dibuat karena RPS belum divalidasi oleh Kaprodi dan Dekan.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_rps_before_meeting
BEFORE INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.enforce_rps_validated_before_meeting();

-- 13. Aktivasi Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS Ketat
CREATE POLICY "Autentikasi wajib untuk membaca profil"
ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Pemilik notifikasi mengelola notifikasinya sendiri"
ON public.notifications FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Mahasiswa hanya dapat absen saat sesi pertemuan berstatus LIVE"
ON public.attendances FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
        SELECT 1 FROM public.meetings m
        JOIN public.class_enrollments ce ON ce.class_id = m.class_id
        WHERE m.id = attendances.meeting_id
          AND m.status = 'LIVE'
          AND ce.student_id = auth.uid()
    )
);

CREATE POLICY "Audit logs hanya dapat dibaca Super Admin"
ON public.audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
);

-- Publikasi Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
```

---

## 10. Struktur Folder Proyek (Next.js App Router + Strict TypeScript)

```text
nexus-obe-portal/
├── .github/
│   └── workflows/
│       └── ci-security-deploy.yml        # GitHub Actions: Lint, Typecheck, Audit, Build
├── public/
│   ├── icons/                            # PWA & Web Push Icons
│   └── sw.js                             # Service Worker (Offline Push Notifications)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx              # Form Login Aman + Rate-Limit + Show/Hide PW
│   │   ├── (portal)/
│   │   │   ├── layout.tsx                # Adaptive Shell (Sidebar Desktop / BottomNav Mobile)
│   │   │   ├── template.tsx              # Framer Motion Page Transition (60 FPS)
│   │   │   ├── dashboard/
│   │   │   │   ├── mahasiswa/page.tsx     # Dashboard Mahasiswa + Live Class Check-In
│   │   │   │   ├── dosen/page.tsx         # Dashboard Dosen + State-Locked Session Start
│   │   │   │   ├── admin/page.tsx         # Dashboard Admin + Validasi RPS & Jadwal
│   │   │   │   └── super-admin/page.tsx   # Dashboard Super Admin + Audit Logs & RBAC
│   │   │   ├── kelas/
│   │   │   │   ├── page.tsx              # Daftar 8 Mata Kuliah Semester 2026/2027 Ganjil
│   │   │   │   └── [classId]/
│   │   │   │       ├── page.tsx          # Detail Kelas, Riwayat Pertemuan, Bobot & PAP
│   │   │   │       ├── rps/page.tsx      # RPS Lengkap (CPL, CPMK, Sub-CPMK & Matriks)
│   │   │   │       └── raport/page.tsx   # E-Raport Nilai Akhir PAP & Ketuntasan CPL
│   │   │   ├── jadwal/page.tsx           # Jadwal Kuliah, UTS, UAS & Deteksi Bentrok
│   │   │   └── notifikasi/page.tsx       # Pusat Notifikasi & Pengaturan Web Push
│   │   ├── api/
│   │   │   ├── auth/callback/route.ts    # Supabase PKCE Callback
│   │   │   ├── push/subscribe/route.ts   # Registrasi Web Push Endpoint
│   │   │   └── cron/
│   │   │       └── schedule-reminders/
│   │   │           └── route.ts          # Vercel Cron: Pengingat Jadwal H-30 & H-10
│   │   ├── globals.css                   # Tailwind CSS + Bootstrap Icons + Reduced Motion
│   │   └── layout.tsx                    # Root Layout + LazyMotion + Toast Provider
│   ├── components/
│   │   ├── ui/
│   │   │   ├── AnimatedButton.tsx        # Tombol Taktil Spring Physics (60 FPS)
│   │   │   ├── GlassCard.tsx             # Kartu UI Adaptif dengan Hover Elevation
│   │   │   ├── SkeletonLoader.tsx        # Shimmer Loading State (Zero CLS)
│   │   │   └── StatusBadge.tsx           # Badge Validasi Kaprodi/Dekan & PBM On/Off
│   │   ├── layout/
│   │   │   ├── SidebarDesktop.tsx        # Sidebar Kiri (Profil NIM/NIDN & Navigasi Role)
│   │   │   ├── BottomNavMobile.tsx       # Navigasi Bawah Otomatis untuk Mobile
│   │   │   ├── TopHeader.tsx             # Header Tahun Akademik, Jam WIB & Bell Notif
│   │   │   └── NotificationBell.tsx      # Dropdown Realtime + Push Permission Prompt
│   │   └── domain/
│   │       ├── MeetingCard.tsx           # Kartu Pertemuan + Foto WebP + Status Kunci
│   │       ├── StartSessionModal.tsx     # Modal Dosen Buka Pertemuan + Auto Kompresi WebP
│   │       ├── SelfCheckInCard.tsx       # Kartu Absensi Mandiri Mahasiswa Real-Time
│   │       ├── RpsMatrixTable.tsx        # Matriks Penghitungan Ketuntasan CPL
│   │       └── ScheduleConflictAlert.tsx # Peringatan Bentrok Ruang & Dosen
│   ├── hooks/
│   │   ├── useDeviceAdaptive.ts          # Deteksi Mobile/Tablet/Desktop & Reduced Motion
│   │   └── useRealtimeNotifications.ts   # Listener WebSocket Supabase Notifications
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser Supabase Client
│   │   │   ├── server.ts                 # Server Components & Actions Client
│   │   │   └── admin.ts                  # Service Role Client (Server & Cron Only)
│   │   ├── security/
│   │   │   ├── rate-limit.ts             # Proteksi Brute-Force Login
│   │   │   ├── sanitize.ts               # Sanitasi Input HTML/XSS (DOMPurify)
│   │   │   └── audit.ts                  # Pencatat Aktivitas ke Tabel audit_logs
│   │   ├── validators/
│   │   │   ├── auth.schema.ts            # Skema Zod Login & Ganti Password
│   │   │   ├── meeting.schema.ts         # Skema Zod Pertemuan & Validasi File Gambar
│   │   │   └── rps.schema.ts             # Skema Zod Validasi Bobot 100%
│   │   └── utils/
│   │       ├── grade-calculator.ts       # Dual Engine: Kalkulator PAP & Ketuntasan CPL
│   │       └── image-compressor.ts       # Kompresor Foto Klien ke WebP (<= 500 KB)
│   ├── middleware.ts                     # Edge RBAC Route Guard & Session Refresh
│   └── types/
│       └── database.types.ts             # TypeScript Interfaces Lengkap dari Supabase
├── .env.example                          # Template Environment Variables
├── next.config.ts                        # Konfigurasi OWASP Security Headers & CSP
├── package.json                          # Dependensi (Next, React, TS, Tailwind, BI, Motion)
├── tsconfig.json                         # Konfigurasi Strict TypeScript
└── vercel.json                           # Konfigurasi Vercel Cron Jobs
```

---

## 11. Workflow Pengembangan, GitHub Repository, & Deployment Vercel

### 11.1 Strategi Branching GitHub
* **`main` (Production):** Dilindungi *Branch Protection Rules*. Setiap *merge* otomatis men-deploy ke domain produksi **Vercel**.
* **`staging` (QA & UAT):** Digunakan untuk pengujian alur lintas-role (`Admin Validasi RPS` $\rightarrow$ `Dosen Buka Kelas` $\rightarrow$ `Mahasiswa Absen & Cek Raport`) melalui *Vercel Preview URL*.
* **`feature/*`:** Branch pengembangan terisolasi per modul fitur.

### 11.2 Pipeline CI/CD GitHub Actions (`.github/workflows/ci-security-deploy.yml`)
Setiap *Pull Request* wajib lolos 4 tahap pemeriksaan otomatis sebelum dapat di-*merge*:
1. **Security Vulnerability Audit:** `npm ci && npm audit --audit-level=high` (Mitigasi OWASP A06).
2. **ESLint & Security Rules Check:** `npm run lint`.
3. **Strict TypeScript Verification:** `npx tsc --noEmit`.
4. **Production Build Verification:** `npm run build`.

### 11.3 Konfigurasi Deployment Vercel
* **Environment Variables (Dashboard Vercel):**
  * `NEXT_PUBLIC_SUPABASE_URL`
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  * `SUPABASE_SERVICE_ROLE_KEY` *(Server-only)*
  * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY` *(Untuk Web Push Offline)*
  * `CRON_SECRET` *(Bearer token pengaman endpoint Cron)*
* **Konfigurasi `vercel.json`:**
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/schedule-reminders",
        "schedule": "*/5 * * * *"
      }
    ]
  }
  ```

---

## 12. Roadmap Implementasi & Checklist Kualitas Produksi

* **Fase 1 — Fondasi Keamanan, Database & RBAC (Hari 1–2):**
  * [ ] Setup repository GitHub, Next.js Strict TypeScript, Tailwind CSS v4, dan Bootstrap Icons 5.
  * [ ] Eksekusi skema SQL Supabase, *Database Views* (`vw_student_final_grades`), *Trigger* validasi RPS, dan kebijakan RLS.
  * [ ] Implementasi form login aman OWASP Top 10 (Zod, Rate Limiting, `HttpOnly` Cookies, Edge Middleware 4-Role).
* **Fase 2 — Mesin Kurikulum OBE & Dual Kalkulasi (Hari 3–5):**
  * [ ] Seeding data 8 mata kuliah semester `2026/2027 Ganjil` termasuk kasus validasi RPS (`Manajemen Proyek TI` berstatus `Belum`).
  * [ ] Pembangunan halaman Detail Kelas, Riwayat Pertemuan, Tab RPS (`CPL`, `CPMK`, `Sub-CPMK`), dan E-Raport PAP.
* **Fase 3 — Sesi Live, Kompresi Foto & Notifikasi Hibrida (Hari 6–7):**
  * [ ] Fitur Dosen *Mulai Pertemuan* dengan kompresor foto `.webp` otomatis dan penguncian sesi otomatis saat jam selesai.
  * [ ] Aktivasi *Supabase Realtime* (In-App Toast) + *Service Worker Web Push* + *Vercel Cron* untuk pengingat jadwal masuk kuliah H-30 & H-10 menit serta pengumuman jadwal UTS/UAS.
* **Fase 4 — Adaptive Device Polish & Audit OWASP Final (Hari 8–9):**
  * [ ] Pengujian responsif di Mobile, Tablet, dan Desktop serta verifikasi animasi $60\text{ FPS}$ dan `prefers-reduced-motion`.
  * [ ] Verifikasi *Security Headers* (CSP, HSTS, X-Frame-Options) dan peluncuran produksi di Vercel.