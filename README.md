# Sistem Helpdesk Fasilitas Kampus — Tim 1 (gacor)

Aplikasi web **full-stack** untuk pencatatan, penugasan, pemantauan SLA, dan pelaporan perbaikan fasilitas kampus (Universitas Klabat · Unit Sarana & Prasarana). Dibangun berdasarkan **SRS** (`REQ-01..21`, `NFR-01..12`, `BR-01..18`) dan diagram pemodelan sistem (Use Case, DFD, ERD, Activity, Sequence).

**Tech Stack:**
- **Backend:** Node.js (`>= 18`) · Express · Prisma ORM · PostgreSQL (Supabase) / SQLite · JWT · Bcrypt · Multer · Zod · Helmet · CORS
- **Frontend:** React · Vite · Lucide React
- **Pengujian:** Node.js Test Runner (`node --test`) · Supertest

---

## Struktur Proyek

```text
Helpdesk-fasilitas-kampus/
├── src/                    # Backend REST API (Express)
│   ├── config.js           # Konfigurasi environment (.env)
│   ├── constants.js        # Enum domain (role, bidang, status, prioritas, dll.)
│   ├── db.js               # Inisialisasi PrismaClient
│   ├── app.js              # Konfigurasi Express, middleware, dan routing utama
│   ├── server.js           # Entry point server & scheduler auto-close
│   ├── middleware/         # Autentikasi JWT, RBAC, error handler, upload foto
│   ├── routes/             # Endpoint auth, master, laporan, pekerjaan, manajemen
│   ├── services/           # Logika bisnis laporan & scheduler auto-close
│   └── utils/              # Helper HTTP response & kalkulasi SLA
├── frontend/               # Aplikasi Web Frontend (React + Vite)
│   ├── src/main.jsx        # Seluruh halaman, komponen UI, dan integrasi API
│   ├── src/styles.css      # Styling aplikasi
│   ├── src/brand-theme.css # Tema warna & identitas kampus
│   └── src/assets/         # Aset gambar kampus & logo
├── prisma/                 # Skema database & seeder
│   ├── schema.prisma       # Definisi model Prisma (PostgreSQL / SQLite)
│   ├── seed.js             # Pengisian data awal (gedung, ruang, jenis, akun uji)
│   └── prepare-sqlite.js   # Helper pembuatan file SQLite sebelum db push
├── tests/                  # Uji end-to-end API (api.test.js)
├── uploads/                # Direktori penyimpanan foto kerusakan (BR-03)
├── database/               # Arsip skema MariaDB lama (tidak dipakai backend aktif)
└── .env.example            # Contoh konfigurasi environment backend
```

> **Catatan tentang folder `database/`:** File SQL di `database/` (`schema.sql`, `seed.sql`, `migration_preserve_history.sql`) adalah dokumentasi/arsip skema MariaDB lama dan **tidak digunakan** oleh backend aktif. Sumber kebenaran skema aktif adalah `prisma/schema.prisma`.

---

## Fitur Sistem & Hak Akses Peran (RBAC)

Sistem membagi akses fitur pada frontend dan backend ke dalam 5 peran (`User.role`):

| Peran | Fitur Utama |
|---|---|
| **ADMIN** | Dashboard KPI & peringatan SLA terlambat; catat laporan baru (WhatsApp/Telepon/Datang Langsung + foto); tetapkan prioritas & target SLA; tugaskan multi-teknisi sesuai bidang; ajukan suku cadang (`> Rp500.000`) & tindak lanjuti; konfirmasi/buka kembali laporan; kelola Data Master (Teknisi, Gedung, Jenis Kerusakan, Pengguna); lihat Laporan Manajemen (bulanan & rekap jam kerja); jalankan auto-close manual; Profil & ganti password. |
| **KEPALA_UNIT** | Dashboard KPI & daftar laporan terlambat; lihat daftar & detail seluruh laporan; pantau Pengajuan Suku Cadang; akses Laporan Manajemen (laporan bulanan per gedung/jenis kerusakan & rekap jam kerja teknisi); Profil & ganti password. |
| **TEKNISI** | Halaman **Pekerjaan Saya** (tab Aktif, Selesai, Semua); lihat detail penugasan; tambah catatan perkembangan (`PROGRES`, `PEMERIKSAAN`, `PERBAIKAN`); tandai pekerjaan selesai (`selesai-teknisi`); catat jam kerja individual per penugasan; Profil & ganti password. |
| **KEUANGAN** | Dashboard Keuangan (ringkasan pengajuan menunggu, total nilai menunggu, dan riwayat selesai); halaman **Pengajuan Suku Cadang**; catat tindak lanjut pengajuan agar laporan yang ditahan (`DITAHAN`) dapat dilanjutkan kembali; Profil & ganti password. |
| **PELAPOR** | Dashboard Pelapor; lihat daftar & detail laporan miliknya sendiri; berikan konfirmasi hasil perbaikan (`SELESAI` atau `BELUM_SELESAI`); Profil & ganti password. |

---

## Cara Menjalankan Secara Lokal

### 1. Menyiapkan Backend & Database

```bash
npm install
cp .env.example .env        # Windows CMD/PowerShell: copy .env.example .env
```

Edit file `.env` dan pastikan variabel berikut terisi:
- `DATABASE_URL` & `DIRECT_URL` — connection string PostgreSQL (default di `.env.example` disiapkan untuk **Supabase PostgreSQL**).
- `JWT_SECRET` — string acak panjang untuk menandatangani token JWT.
- `SEED_PASSWORD` — **wajib diisi** sebelum menjalankan `npm run setup` atau `npm run db:seed` (digunakan sebagai password seluruh akun uji).

Kemudian jalankan setup database dan server backend:

```bash
npm run setup               # buat tabel (prisma db push) + isi data awal (seed)
npm run dev                 # jalankan server development (http://localhost:3000)
# atau untuk produksi:
npm start
```

> **Jika ingin memakai SQLite lokal alih-alih PostgreSQL:**
> 1. Pada `prisma/schema.prisma`, ubah `provider = "postgresql"` menjadi `provider = "sqlite"` dan hapus baris `directUrl = env("DIRECT_URL")`.
> 2. Pada `.env`, atur `DATABASE_URL="file:./dev.db"`.
> 3. Jalankan `npm run setup`.

### 2. Menyiapkan Frontend

Buka terminal baru di folder `frontend/`:

```bash
cd frontend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Pastikan isi `frontend/.env` mengarah ke URL backend:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Jalankan server development frontend:

```bash
npm run dev                 # http://localhost:5173
```

Untuk build produksi frontend:

```bash
npm run build               # menghasilkan folder frontend/dist
npm run preview             # pratinjau hasil build
```

### 3. Pengujian End-to-End

```bash
npm test
```

> **Catatan:** `tests/api.test.js` menguji alur API menggunakan database SQLite terpisah (`prisma/test.db`). Karena `prisma/schema.prisma` saat ini dikonfigurasi untuk `provider = "postgresql"`, pastikan `provider` diubah ke `"sqlite"` (tanpa `directUrl`) apabila ingin menjalankan `npm test` secara lokal dengan SQLite.

---

## Akun Uji & Data Awal (Seed)

Seeder (`prisma/seed.js`) menggunakan password dari `SEED_PASSWORD` di `.env` dan membuat akun uji untuk setiap aktor SRS (NFR-04):

| Username | Peran | Aktor SRS / Keterangan |
|---|---|---|
| `admin` | `ADMIN` | Admin (Ibu Vonny) |
| `kepala` | `KEPALA_UNIT` | Kepala Unit (Pak Jefry Sumual) |
| `keuangan` | `KEUANGAN` | Staf Bagian Keuangan |
| `pelapor` | `PELAPOR` | Pelapor Uji |
| `teknisi.listrik` | `TEKNISI` | Budi — Bidang `LISTRIK` |
| `teknisi.ac` | `TEKNISI` | Andi — Bidang `AC` |
| `teknisi.bangunan` | `TEKNISI` | Rudi — Bidang `BANGUNAN` |
| `teknisi.air` | `TEKNISI` | Joko — Bidang `AIR` |

Selain akun, seed juga mengisi:
- **8 Gedung** (BR-01): `Gedung A` s.d. `Gedung F`, `Gedung Rektorat`, dan `Gedung Perpustakaan`.
- **6 Ruang per Gedung**: `Ruang 101`, `Ruang 102`, `Ruang 201`, `Ruang 202`, `Toilet Lt.1`, `Koridor`.
- **12 Jenis Kerusakan** pada 4 bidang (`LISTRIK`, `AC`, `BANGUNAN`, `AIR`).

---

## Skema Database (Pemetaan ERD → Prisma)

| Entitas ERD | Model Prisma | Relasi & Keterangan |
|---|---|---|
| Pelapor | `Pelapor` | 1:N `Laporan`, opsional 1:1 `User` |
| Gedung / Ruang | `Gedung`, `Ruang` | `Gedung` 1:N `Ruang`, `Ruang` 1:N `Laporan` (unik `[gedungId, namaRuang]`) |
| JenisKerusakan | `JenisKerusakan` | Menyimpan `bidang` (`LISTRIK`, `AC`, `BANGUNAN`, `AIR`), 1:N `Laporan` |
| Laporan | `Laporan` | Pusat transaksi (`kode` unik, prioritas, `targetSla`, status, foto, deskripsi) |
| Teknisi | `Teknisi` | Profil teknisi (`bidang`, `aktif`) + akun `User`, 1:N `Penugasan` |
| Penugasan | `Penugasan` | `Laporan` 1:N, `Teknisi` 1:N (mendukung multi-teknisi, BR-09) |
| Perkembangan | `Perkembangan` | Riwayat perubahan status, pemeriksaan, dan progres pekerjaan |
| JamKerja | `JamKerja` | `Penugasan` 1:N (durasi jam desimal per teknisi per pekerjaan, BR-10) |
| Konfirmasi | `Konfirmasi` | `Laporan` 0..N (menyimpan riwayat konfirmasi saat laporan dibuka kembali) |
| PengajuanSukuCadang | `PengajuanSukuCadang` | `Laporan` 0..N (kebutuhan suku cadang `> Rp500.000`, BR-11) |
| *(autentikasi)* | `User` | Akun login, hash password (`bcryptjs`), dan peran RBAC (NFR-05/06) |

---

## Siklus Status Laporan

```text
BARU ──tugaskan──▶ DITUGASKAN ──progres──▶ DIKERJAKAN ──selesai teknisi──▶ MENUNGGU_KONFIRMASI
  ▲                                         │   ▲                              │
  │                          pengajuan>500rb▼   │ditindaklanjuti               ├─ SELESAI (dikonfirmasi pelapor)
  │                                       DITAHAN                              ├─ SELESAI_OTOMATIS (3 hari tanpa tanggapan)
  └──────────── DIBUKA_KEMBALI ◀──── pelapor: belum selesai ───────────────────┘
```

---

## Ringkasan Endpoint API

Semua endpoint (kecuali `/`, `/api/health`, dan `/api/auth/login`) memerlukan header `Authorization: Bearer <token>`.  
Format respons standar: `{ success: true, message?, data }` atau `{ success: false, message, details? }` (NFR-11).

### Umum & Referensi
| Method | Path | Peran | Keterangan |
|---|---|---|---|
| GET | `/`, `/api/health` | publik | Status layanan API |
| GET | `/api/referensi` | semua | Enum (`role`, `bidang`, `sumberLaporan`, `prioritas`, `status`, dll.), ambang suku cadang, dan konfigurasi aktif |
| GET | `/api/sla/pratinjau?prioritas=DARURAT` | semua | Pratinjau target SLA berdasarkan prioritas (REQ-05) |

### Auth — `/api/auth`
| Method | Path | Peran | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | publik | Login dengan `username` & `password`, mengembalikan token JWT |
| GET | `/api/auth/me` | semua | Data profil pengguna yang sedang login |
| POST | `/api/auth/ganti-password` | semua | Ganti password akun sendiri |

### Master Data — `/api/master`
Endpoint tersedia untuk `gedung`, `ruang?gedungId=`, `jenis-kerusakan`, `teknisi?bidang=&aktif=`, `pelapor?q=`, dan `users`:
- `GET`: dapat diakses oleh pengguna internal sesuai kebutuhan aplikasi.
- `POST`, `PUT`, `PATCH`, `DELETE`: khusus `ADMIN`.

### Laporan — `/api/laporan`
| Method | Path | Peran | SRS |
|---|---|---|---|
| GET | `/` | semua (dibatasi per peran) | Filter: `status`, `prioritas`, `gedungId`, `jenisId`, `teknisiId`, `belumSelesai`, `terlambat`, `dari`, `sampai`, `q`, `page`, `limit` (REQ-21) |
| GET | `/:id` | sesuai akses | Detail laporan + riwayat perkembangan, penugasan, jam kerja, konfirmasi, pengajuan (REQ-08, REQ-21) |
| POST | `/` | `ADMIN` | *Multipart* (`foto`, `sumberLaporan`, `ruangId`, `jenisId`, `deskripsi`, `prioritas?`, `pelaporId` / `pelaporNama` + `pelaporKontak`) (REQ-01..03, UC-03) |
| PUT | `/:id`, `/:id/foto` | `ADMIN` | Ubah data laporan atau ganti foto |
| PATCH | `/:id/prioritas` | `ADMIN` | Tetapkan/ubah prioritas `{ prioritas }` & hitung ulang SLA (REQ-04, REQ-05) |
| POST | `/:id/penugasan` | `ADMIN` | Tugaskan teknisi `{ teknisiIds: [...] }` (REQ-06, REQ-07, UC-04) |
| DELETE | `/:id/penugasan/:penugasanId` | `ADMIN` | Batalkan/alihkan penugasan |
| POST | `/:id/perkembangan` | `TEKNISI` (ditugaskan), `ADMIN` | Catat `{ jenis: PROGRES \| PEMERIKSAAN \| PERBAIKAN, catatan }` (REQ-10, UC-05) |
| PATCH | `/:id/status` | `TEKNISI`, `ADMIN` | Ubah status `{ status: DIKERJAKAN \| MENUNGGU_KONFIRMASI, catatan }` (REQ-09) |
| POST | `/:id/selesai-teknisi` | `TEKNISI`, `ADMIN` | Tandai pekerjaan selesai oleh teknisi `{ catatan }` (UC-06, BR-12) |
| POST | `/:id/konfirmasi` | `ADMIN`, `PELAPOR` (miliknya) | Catat `{ hasil: SELESAI \| BELUM_SELESAI \| TIDAK_ADA_TANGGAPAN, catatan, teknisiIds? }` (REQ-12..14) |
| POST | `/:id/buka-kembali` | `ADMIN` | Buka kembali laporan `{ catatan, teknisiIds? }` (REQ-13, UC-11) |
| POST | `/:id/pengajuan` | `ADMIN` | Ajukan suku cadang `{ namaBarang, nilai (> 500000), catatan }` (REQ-19, REQ-20) |

### Pekerjaan Teknisi, Jam Kerja, & Pengajuan Suku Cadang — `/api`
| Method | Path | Peran | SRS |
|---|---|---|---|
| GET | `/pekerjaan-saya?status=aktif\|selesai\|semua` | `TEKNISI` | Daftar pekerjaan milik teknisi (REQ-08, UC-10) |
| GET / POST | `/penugasan/:id/jam-kerja` | `TEKNISI` (miliknya), `ADMIN` | Lihat / catat jam kerja `{ durasiJam, tanggal?, catatan? }` (REQ-11, UC-07) |
| DELETE | `/jam-kerja/:id` | `TEKNISI` (miliknya), `ADMIN` | Hapus catatan jam kerja |
| GET | `/pengajuan?status=MENUNGGU\|DITINDAKLANJUTI` | `ADMIN`, `KEUANGAN`, `KEPALA_UNIT` | Daftar pengajuan suku cadang (UC-09) |
| PATCH | `/pengajuan/:id/tindak-lanjut` | `ADMIN`, `KEUANGAN` | Tindak lanjuti pengajuan `{ catatan }` & kembalikan status laporan (REQ-20) |

### Manajemen — `/api/manajemen` (`ADMIN`, `KEPALA_UNIT`)
| Method | Path | Keterangan | SRS |
|---|---|---|---|
| GET | `/dashboard` | Ringkasan KPI, distribusi status, & `peringatanTerlambat` | REQ-15, UC-08 |
| GET | `/belum-selesai` | Daftar laporan yang masih aktif/belum selesai | REQ-16 |
| GET | `/terlambat?termasukSelesai=` | Daftar laporan yang melewati target SLA | REQ-15, REQ-16 |
| GET | `/laporan-bulanan?bulan=YYYY-MM` | Rekap per gedung, per jenis, matriks, & rincian laporan | REQ-17, UC-12 |
| GET | `/rekap-jam-kerja?bulan=&teknisiId=&laporanId=` | Rekap jam kerja per teknisi & per pekerjaan | REQ-18, UC-13 |
| POST | `/auto-close/jalankan` | Jalankan penutupan otomatis secara manual (khusus `ADMIN`) | REQ-14 |

---

## Variabel Lingkungan (`.env`) & Asumsi Poin SRS

Seluruh aturan yang masih dapat disesuaikan diatur melalui `.env` atau `src/utils/sla.js`:

| Poin / Variabel | Default | Keterangan |
|---|---|---|
| Titik awal SLA (REQ-05) | `tanggalLapor` | Dihitung sejak laporan dicatat/diterima |
| Target SLA (`src/utils/sla.js`) | `DARURAT` = 4 jam; `TINGGI` = 24 jam; `NORMAL` = 3 hari kerja | `DARURAT` berlaku 24/7 termasuk malam/akhir pekan/libur (BR-18); `NORMAL` melewati Sabtu & Minggu |
| `WAJIB_FOTO` (BR-03) | `true` | Menolak laporan tanpa foto; set `false` jika ingin mengizinkan tanpa foto |
| `MAX_UPLOAD_MB` | `5` | Batas ukuran file foto yang diunggah (MB) |
| `AUTO_CLOSE_HARI` (REQ-14) | `3` | Jumlah hari tanpa tanggapan sebelum laporan berstatus `MENUNGGU_KONFIRMASI` ditutup otomatis |
| `AUTO_CLOSE_MODE` | `kalender` | `kalender` atau `kerja` (Senin–Jumat) |
| `AUTO_CLOSE_INTERVAL_MENIT` | `60` | Interval pengecekan scheduler auto-close |
| `AKTIFKAN_SCHEDULER` | `true` | Set `false` untuk menonaktifkan background scheduler |
| Ambang suku cadang (BR-11) | `> 500000` | Per pengajuan/barang; nilai `<= 500.000` ditolak; penahanan ke `DITAHAN` tidak menghentikan hitungan SLA |
| Keputusan Bagian Keuangan | `MENUNGGU` → `DITINDAKLANJUTI` | Tidak dimodelkan sebagai setuju/tolak; setelah ditindaklanjuti, laporan kembali ke status sebelum ditahan |
| Relasi `Konfirmasi` | `0..N` per laporan | Diubah dari `0..1` agar seluruh riwayat konfirmasi tetap tersimpan saat laporan dibuka kembali (BR-13) |

---

## Panduan Deploy ke Produksi (NFR-03)

1. **Database:** Gunakan PostgreSQL (mis. Supabase / Railway / Neon) dan pastikan `provider = "postgresql"` di `prisma/schema.prisma`.
2. **Backend:**
   - Set environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SEED_PASSWORD`, `TZ=Asia/Makassar`, dan `CORS_ORIGIN=<url frontend>`.
   - Build & jalankan: `npm install`, lalu `npm run setup` (cukup sekali saat inisialisasi), dan `npm start`.
   - Sediakan disk persisten (volume) untuk folder `uploads/` agar foto laporan tidak hilang saat restart, atau integrasikan dengan object storage.
3. **Frontend:**
   - Set `VITE_API_BASE_URL=<url backend>/api` di environment build frontend.
   - Jalankan `cd frontend && npm install && npm run build`, lalu host folder `frontend/dist` (Vercel, Netlify, Cloudflare Pages, atau Nginx).
