# Dokumentasi Lengkap Sistem Helpdesk Fasilitas Kampus

**Unit Sarana & Prasarana — Universitas Klabat**  
**Tim Pengembang:** Tim 1 (gacor)

---

## 1. Pendahuluan & Tujuan Sistem

Sistem **Helpdesk Fasilitas Kampus** adalah aplikasi web *full-stack* untuk mencatat, menugaskan, memantau *Service Level Agreement* (SLA), mengelola kebutuhan suku cadang, serta mengevaluasi kinerja perbaikan fasilitas kampus secara terpusat.

Tujuan utama sistem:
- Menggantikan pencatatan laporan kerusakan manual (WhatsApp, telepon, datang langsung) menjadi tiket terstruktur dengan kode unik (`LPR-YYYYMM-XXXX`).
- Memastikan setiap laporan memiliki prioritas dan target SLA yang terukur.
- Memudahkan penugasan multi-teknisi sesuai bidang keahlian (`LISTRIK`, `AC`, `BANGUNAN`, `AIR`).
- Menyediakan transparansi progres perbaikan, pencatatan jam kerja teknisi, alur pengajuan suku cadang (`> Rp500.000`), konfirmasi pelapor, hingga pelaporan manajemen bulanan.

---

## 2. Arsitektur & Tech Stack

### 2.1 Teknologi yang Digunakan
| Lapisan | Teknologi |
|---|---|
| **Backend Runtime & Framework** | Node.js (`>= 18`), Express 4 |
| **ORM & Database** | Prisma ORM 6 (`PostgreSQL` untuk produksi/Supabase, `SQLite` untuk pengujian lokal terisolasi) |
| **Autentikasi & Keamanan** | JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, validasi input `zod` |
| **Upload File** | `multer` (penyimpanan disk lokal `uploads/`, batas ukuran & tipe MIME gambar) |
| **Frontend** | React, Vite, Lucide React |
| **Pengujian** | Node.js Test Runner (`node --test`), Supertest, Playwright (`tests/e2e.spec.js`) |

### 2.2 Struktur Direktori Proyek
```text
Helpdesk-fasilitas-kampus/
├── src/
│   ├── app.js                  # Konfigurasi Express, middleware, static /uploads, routing utama
│   ├── server.js               # Entry point server & scheduler auto-close
│   ├── config.js               # Loader variabel lingkungan (.env)
│   ├── constants.js            # Enum domain (ROLE, BIDANG, STATUS, PRIORITAS, dll.)
│   ├── db.js                   # Inisialisasi PrismaClient (mendukung PRISMA_CLIENT_PATH untuk test)
│   ├── middleware/
│   │   ├── auth.js             # Autentikasi JWT (authenticate) & RBAC (authorize)
│   │   ├── error.js            # Handler 404 & error terstandar
│   │   ├── upload.js           # Konfigurasi multer untuk upload foto kerusakan
│   │   └── validate.js         # Middleware validasi Zod
│   ├── routes/
│   │   ├── auth.js             # Login, profil (/me), ganti password
│   │   ├── master.js           # CRUD gedung, ruang, jenis kerusakan, teknisi, pelapor, users
│   │   ├── laporan.js          # Pencatatan, edit, prioritas, penugasan, progres, konfirmasi, pengajuan
│   │   ├── pekerjaan.js        # Pekerjaan teknisi, jam kerja, tindak lanjut pengajuan suku cadang
│   │   └── manajemen.js        # Dashboard KPI, daftar terlambat, laporan bulanan, rekap jam kerja, auto-close
│   ├── services/
│   │   ├── laporanService.js   # Helper query, otorisasi akses laporan, serialisasi, catat perkembangan
│   │   └── autoClose.js        # Logika & scheduler penutupan otomatis (BR-14)
│   └── utils/
│       ├── http.js             # Helper response & HTTP error (badRequest, unauthorized, forbidden, conflict, notFound)
│       └── sla.js              # Perhitungan target SLA & deteksi keterlambatan
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx            # Seluruh halaman, modal, komponen UI, dan integrasi API
│       ├── styles.css          # Layout, komponen, tabel, modal, responsif mobile
│       └── brand-theme.css     # Identitas visual & tema kampus
├── prisma/
│   ├── schema.prisma           # Skema database aktif (PostgreSQL)
│   ├── seed.js                 # Seeder data awal (gedung, ruang, jenis kerusakan, akun uji)
│   └── prepare-sqlite.js       # Helper inisialisasi file SQLite
├── docs/
│   ├── QA_TEST_CASES.md        # Matriks skenario pengujian QA
│   └── DOKUMENTASI_SISTEM.md   # Dokumentasi sistem end-to-end (dokumen ini)
├── tests/
│   ├── api.test.js             # Uji integrasi API otomatis (8 skenario end-to-end)
│   └── e2e.spec.js             # Uji E2E browser dengan Playwright
├── uploads/                    # Direktori penyimpanan foto kerusakan
├── .env.example                # Template konfigurasi environment backend
└── package.json                # Dependensi & skrip backend
```

---

## 3. Aktor & Hak Akses (RBAC)

Sistem membagi pengguna ke dalam **5 peran** (`User.role`):

| Peran | Tanggung Jawab & Hak Akses Utama |
|---|---|
| **ADMIN** | Mencatat laporan baru (WhatsApp/Telepon/Datang Langsung + foto), mengedit laporan & mengganti foto, menetapkan/mengubah prioritas & SLA, menugaskan & membatalkan multi-teknisi, mengajukan suku cadang (`> Rp500.000`), menindaklanjuti pengajuan, membuka kembali / mengonfirmasi laporan, mengelola seluruh Data Master CRUD, menjalankan auto-close manual, melihat Laporan Manajemen & Dashboard KPI. |
| **KEPALA_UNIT** | Memantau Dashboard KPI dan daftar peringatan laporan terlambat SLA, melihat daftar & detail seluruh laporan, memantau pengajuan suku cadang, serta mengakses Laporan Manajemen (bulanan per gedung/jenis kerusakan & rekap jam kerja teknisi) beserta ekspor CSV/cetak. |
| **TEKNISI** | Melihat daftar **Pekerjaan Saya** (tab Aktif, Selesai, Semua) yang diurutkan berdasarkan prioritas & target SLA, mencatat perkembangan (`PROGRES`, `PEMERIKSAAN`, `PERBAIKAN`), mencatat/menghapus jam kerja pada penugasan miliknya, dan menandai pekerjaan selesai (`selesai-teknisi`). |
| **KEUANGAN** | Memantau Dashboard Keuangan (pengajuan menunggu, total nilai menunggu, riwayat selesai), meninjau daftar pengajuan suku cadang, dan mencatat tindak lanjut agar laporan berstatus `DITAHAN` dapat dilanjutkan kembali. |
| **PELAPOR** | Melihat Dashboard Pelapor, daftar & detail laporan miliknya sendiri, serta memberikan konfirmasi hasil perbaikan (`SELESAI` atau `BELUM_SELESAI`). |

---

## 4. Desain Database (Skema Prisma)

Sumber kebenaran skema aktif berada di `prisma/schema.prisma`:

| Model | Deskripsi & Relasi Utama |
|---|---|
| `User` | Akun login (`username` unik, `password` hash bcrypt, `nama`, `role`, `aktif`). Opsional berelasi 1:1 ke `Teknisi` atau `Pelapor`. |
| `Pelapor` | Data pelapor (`nama`, `kontak` opsional, `userId` opsional). Berelasi 1:N dengan `Laporan`. |
| `Teknisi` | Profil teknisi (`nama`, `bidang`, `aktif`, `userId` opsional). Berelasi 1:N dengan `Penugasan`. |
| `Gedung` | Master gedung kampus (`namaGedung` unik). Berelasi 1:N dengan `Ruang`. |
| `Ruang` | Master ruang per gedung (`namaRuang`, `gedungId`, unik `[gedungId, namaRuang]`). Berelasi 1:N dengan `Laporan`. |
| `JenisKerusakan` | Kategori kerusakan (`namaJenis` unik, `bidang`: `LISTRIK` \| `AC` \| `BANGUNAN` \| `AIR`). Berelasi 1:N dengan `Laporan`. |
| `Laporan` | Entitas transaksi utama (`kode` unik, `tanggalLapor`, `sumberLaporan`, `prioritas`, `targetSla`, `status`, `statusSebelumDitahan`, `tglSelesaiTeknisi`, `tglDitutup`, `foto`, `deskripsi`). |
| `Penugasan` | Relasi penugasan `Laporan` ↔ `Teknisi` (`tglTugas`, `statusTugas`: `AKTIF` \| `SELESAI` \| `DIBATALKAN`). Mendukung multi-teknisi per laporan. |
| `Perkembangan` | Riwayat kronologis aktivitas laporan (`waktu`, `status`, `jenis`, `catatan`, `userId`). |
| `JamKerja` | Catatan durasi kerja teknisi (`durasiJam` desimal, `tanggal`, `catatan`, terikat ke `Penugasan`). |
| `Konfirmasi` | Riwayat konfirmasi hasil perbaikan (`hasil`: `SELESAI` \| `BELUM_SELESAI` \| `TIDAK_ADA_TANGGAPAN`, `tanggal`, `catatan`). Relasi 0..N agar riwayat tetap tersimpan saat laporan dibuka kembali. |
| `PengajuanSukuCadang` | Pengajuan suku cadang bernilai `> Rp500.000` (`namaBarang`, `nilai`, `status`: `MENUNGGU` \| `DITINDAKLANJUTI`, `catatan`, `tglTindakLanjut`, `catatanTindakLanjut`). |

---

## 5. Aturan Bisnis & Alur Operasional

### 5.1 Siklus Hidup Status Laporan
```text
BARU ──tugaskan──▶ DITUGASKAN ──progres──▶ DIKERJAKAN ──selesai teknisi──▶ MENUNGGU_KONFIRMASI
  ▲                                         │   ▲                              │
  │                          pengajuan>500rb▼   │ditindaklanjuti               ├─ SELESAI (konfirmasi pelapor/admin)
  │                                       DITAHAN                              ├─ SELESAI_OTOMATIS (3 hari tanpa tanggapan)
  └──────────── DIBUKA_KEMBALI ◀──── pelapor/admin: belum selesai ─────────────┘
```

### 5.2 Aturan SLA (`src/utils/sla.js`)
Titik awal perhitungan SLA adalah `tanggalLapor`:
- **DARURAT:** `+4 jam` kalender (berlaku 24/7 termasuk malam, akhir pekan, dan hari libur).
- **TINGGI:** `+24 jam` kalender (`1 hari`).
- **NORMAL:** `+3 hari kerja` (melewati hari Sabtu dan Minggu).
- Laporan dianggap **terlambat** apabila waktu aktual (atau `tglSelesaiTeknisi` jika sudah selesai dikerjakan teknisi) melewati `targetSla`.

### 5.3 Aturan Bisnis Penting Lainnya
- **Foto Kerusakan (BR-03):** Wajib dilampirkan saat mencatat laporan jika `WAJIB_FOTO=true`. Format yang diterima: JPG, PNG, WEBP, HEIC/HEIF (maksimal `MAX_UPLOAD_MB`, default `5 MB`).
- **Pengajuan Suku Cadang (BR-11):** Hanya pengajuan dengan `nilai > 500000` yang diterima. Saat diajukan, status laporan otomatis menjadi `DITAHAN` (hitungan SLA tetap berjalan) dan kembali ke `statusSebelumDitahan` setelah semua pengajuan menunggu pada laporan tersebut ditindaklanjuti.
- **Auto-Close (BR-14):** Laporan berstatus `MENUNGGU_KONFIRMASI` yang melewati batas `AUTO_CLOSE_HARI` (default `3` hari) sejak `tglSelesaiTeknisi` tanpa tanggapan akan ditutup otomatis menjadi `SELESAI_OTOMATIS`.
- **Pembatasan Status Final:** Laporan berstatus `SELESAI` atau `SELESAI_OTOMATIS` tidak dapat diedit, diganti fotonya, maupun ditambah/dihapus jam kerjanya.

---

## 6. Spesifikasi API Backend

Format respons standar:
- Sukses: `{ "success": true, "message": "...", "data": ... }`
- Gagal: `{ "success": false, "message": "...", "details": ... }`

Seluruh endpoint selain `/`, `/api/health`, dan `/api/auth/login` membutuhkan header `Authorization: Bearer <token>`.

### 6.1 Umum & Autentikasi
- `GET /`, `GET /api/health` — Status layanan API (publik).
- `GET /api/referensi` — Enum domain, konfigurasi aktif (`wajibFoto`, `autoClose`, `ambangSukuCadang`), dan contoh target SLA.
- `GET /api/sla/pratinjau?prioritas=DARURAT|TINGGI|NORMAL` — Pratinjau target SLA.
- `POST /api/auth/login` — Login, mengembalikan token JWT dan profil pengguna.
- `GET /api/auth/me` — Profil pengguna yang sedang login.
- `POST /api/auth/ganti-password` — Ganti password akun sendiri.

### 6.2 Master Data (`/api/master`)
- `GET /gedung`, `GET /ruang?gedungId=`, `GET /jenis-kerusakan`, `GET /teknisi?bidang=&aktif=`, `GET /pelapor?q=`, `GET /users`
- `POST`, `PUT`, `PATCH`, `DELETE` pada resource master di atas (khusus `ADMIN`).

### 6.3 Laporan (`/api/laporan`)
- `GET /` — Daftar laporan dengan filter `status`, `prioritas`, `gedungId`, `jenisId`, `teknisiId`, `belumSelesai`, `terlambat`, `dari`, `sampai`, `q`, `page`, `limit`.
- `GET /:id` — Detail laporan lengkap (riwayat perkembangan, penugasan, jam kerja, konfirmasi, pengajuan).
- `POST /` — Catat laporan baru (*multipart/form-data*, khusus `ADMIN`).
- `PUT /:id`, `PUT /:id/foto` — Ubah data laporan atau ganti foto (khusus `ADMIN`, sebelum status final).
- `PATCH /:id/prioritas` — Tetapkan/ubah prioritas & hitung ulang SLA (`ADMIN`).
- `POST /:id/penugasan`, `DELETE /:id/penugasan/:penugasanId` — Tugaskan multi-teknisi / batalkan penugasan (`ADMIN`).
- `POST /:id/perkembangan` — Tambah catatan perkembangan (`TEKNISI` ditugaskan / `ADMIN`).
- `PATCH /:id/status` — Ubah status `DIKERJAKAN` / `MENUNGGU_KONFIRMASI`.
- `POST /:id/selesai-teknisi` — Teknisi menyatakan pekerjaan selesai.
- `POST /:id/konfirmasi` — Konfirmasi hasil perbaikan (`PELAPOR` pemilik laporan / `ADMIN`).
- `POST /:id/buka-kembali` — Buka kembali laporan (`ADMIN`).
- `POST /:id/pengajuan` — Ajukan suku cadang `> Rp500.000` (`ADMIN`).

### 6.4 Pekerjaan Teknisi, Jam Kerja, & Pengajuan (`/api`)
- `GET /pekerjaan-saya?status=aktif|selesai|semua` — Daftar pekerjaan milik `TEKNISI`.
- `GET /penugasan/:id/jam-kerja`, `POST /penugasan/:id/jam-kerja`, `DELETE /jam-kerja/:id` — Kelola jam kerja (`TEKNISI` pemilik / `ADMIN`).
- `GET /pengajuan?status=MENUNGGU|DITINDAKLANJUTI`, `PATCH /pengajuan/:id/tindak-lanjut` — Pantau & tindak lanjuti pengajuan suku cadang (`KEUANGAN`, `ADMIN`, `KEPALA_UNIT` untuk lihat).

### 6.5 Manajemen (`/api/manajemen`, khusus `ADMIN` & `KEPALA_UNIT`)
- `GET /dashboard` — KPI ringkasan, distribusi status, dan `peringatanTerlambat`.
- `GET /belum-selesai` — Daftar laporan aktif.
- `GET /terlambat?termasukSelesai=true|false` — Daftar laporan terlambat SLA.
- `GET /laporan-bulanan?bulan=YYYY-MM` — Rekap laporan per gedung, per jenis kerusakan, matriks, dan rincian.
- `GET /rekap-jam-kerja?bulan=&teknisiId=&laporanId=` — Rekap jam kerja per teknisi & per pekerjaan.
- `POST /auto-close/jalankan` — Jalankan auto-close secara manual (khusus `ADMIN`).

---

## 7. Panduan Pengguna Aplikasi Web (`frontend/src/main.jsx`)

1. **Login:** Masuk menggunakan `username` dan `password`. Sistem otomatis mengarahkan ke dashboard sesuai peran.
2. **Notifikasi Topbar:** Klik ikon lonceng di kanan atas untuk melihat daftar cepat item yang butuh perhatian sesuai peran (laporan terlambat untuk Admin/Kepala Unit, pekerjaan aktif untuk Teknisi, pengajuan menunggu untuk Keuangan, laporan menunggu konfirmasi untuk Pelapor).
3. **Admin:**
   - Gunakan **Catat laporan** dari Dashboard atau menu **Laporan Kerusakan** untuk input tiket baru beserta foto.
   - Buka detail laporan untuk **Edit laporan**, ubah **Prioritas**, tugaskan/batalkan **Teknisi**, atau pantau timeline.
   - Kelola pengajuan suku cadang di menu **Pengajuan Suku Cadang** dan referensi operasional di menu **Data Master** (Tambah, Edit, Aktif/Nonaktifkan, Hapus).
   - Di menu **Laporan Manajemen**, gunakan **Export CSV**, **Cetak**, atau **Jalankan Auto-Close**.
4. **Kepala Unit:** Pantau KPI keterlambatan di Dashboard, periksa detail laporan, dan unduh/cetak rekap di **Laporan Manajemen**.
5. **Teknisi:** Buka **Pekerjaan Saya**, pilih tiket, tambahkan catatan progres, catat durasi jam kerja, lalu klik **Tandai selesai** setelah perbaikan selesai.
6. **Bagian Keuangan:** Buka **Pengajuan Suku Cadang** (atau klik dari Dashboard Keuangan), isi catatan tindak lanjut, lalu klik **Tandai selesai** agar pekerjaan dapat dilanjutkan.
7. **Pelapor:** Buka laporan yang berstatus **Menunggu Konfirmasi** dan pilih **Sudah selesai** atau **Belum selesai** beserta catatan tambahan.

---

## 8. Instalasi, Konfigurasi, & Deployment

### 8.1 Setup Lokal Backend
```bash
npm install
copy .env.example .env    # Linux/macOS: cp .env.example .env
```
Isi variabel penting di `.env`:
- `DATABASE_URL` & `DIRECT_URL` (PostgreSQL / Supabase)
- `JWT_SECRET` (string acak panjang)
- `SEED_PASSWORD` (wajib diisi sebelum seeding)

Jalankan setup database dan server:
```bash
npm run setup             # push skema ke database + jalankan prisma/seed.js
npm run dev               # server development di http://localhost:3000
```

### 8.2 Setup Lokal Frontend
```bash
cd frontend
npm install
copy .env.example .env    # pastikan VITE_API_BASE_URL=http://localhost:3000/api
npm run dev               # server frontend di http://localhost:5173
```

### 8.3 Build Produksi
- Backend: jalankan `npm start` dengan `NODE_ENV=production`, `TZ=Asia/Makassar`, `CORS_ORIGIN=<url-frontend>`, serta disk persisten untuk folder `uploads/`.
- Frontend: jalankan `cd frontend && npm run build` untuk menghasilkan bundel statis di `frontend/dist/`.

---

## 9. Pengujian & Jaminan Kualitas

1. **Uji Integrasi API Otomatis (`npm test`):**
   - Menjalankan `tests/api.test.js` menggunakan SQLite terisolasi di `tests/tmp/test.db` (menghasilkan skema & Prisma Client uji sementara di `tests/tmp/` tanpa mengubah konfigurasi PostgreSQL di `prisma/schema.prisma`).
   - Mencakup 8 skenario end-to-end: autentikasi & RBAC, alur penuh laporan (catat → prioritas → penugasan → progres → ditahan → selesai → buka kembali → konfirmasi), auto-close 3 hari, isolasi akses pelapor, laporan manajemen kepala unit, larangan ubah laporan final, validasi upload & SLA, serta data master & akun nonaktif.
2. **Matriks QA Manual & Otomatis:** Terdokumentasi pada `docs/QA_TEST_CASES.md`.
3. **Uji E2E Browser:** Tersedia di `tests/e2e.spec.js` (konfigurasi di `playwright.config.js`).
