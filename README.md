# Backend Helpdesk Fasilitas Kampus — Tim 1 (gacor)

REST API untuk sistem Helpdesk Fasilitas Kampus, dibangun dari **SRS** (REQ-01..21, NFR-01..12, BR-01..18) dan **diagram JSON** (Use Case, DFD, ERD, Activity, Sequence).

**Stack:** Node.js · Express · Prisma ORM · SQLite (lokal) / PostgreSQL (produksi) · JWT · Multer · Zod

## Menjalankan

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run setup               # buat tabel + isi data awal (seed)
npm run dev                 # http://localhost:3000
npm test                    # uji end-to-end (DB terpisah)
```

### Akun uji (NFR-04) — password: `password123`

| Username | Peran | Aktor SRS |
|---|---|---|
| `admin` | ADMIN | Admin (Ibu Vonny) |
| `kepala` | KEPALA_UNIT | Kepala Unit (Pak Jefry Sumual) |
| `keuangan` | KEUANGAN | Bagian Keuangan |
| `pelapor` | PELAPOR | Pelapor |
| `teknisi.listrik`, `teknisi.ac`, `teknisi.bangunan`, `teknisi.air` | TEKNISI | Teknisi per bidang (BR-01) |

Seed juga membuat 8 gedung (BR-01), ruang, dan 12 jenis kerusakan untuk bidang Listrik/AC/Bangunan/Air.

## Pemetaan ERD → Tabel

| Entitas ERD | Model Prisma | Relasi |
|---|---|---|
| Pelapor | `Pelapor` | 1:N Laporan |
| Gedung / Ruang | `Gedung`, `Ruang` | Gedung 1:N Ruang, Ruang 1:N Laporan |
| JenisKerusakan | `JenisKerusakan` (+ `bidang`) | 1:N Laporan |
| Laporan | `Laporan` | pusat transaksi |
| Teknisi | `Teknisi` (+ akun `User`) | 1:N Penugasan |
| Penugasan | `Penugasan` | Laporan 1:N, Teknisi 1:N (multi teknisi, BR-09) |
| Perkembangan | `Perkembangan` | riwayat status/progres |
| JamKerja | `JamKerja` | Penugasan 1:N (per teknisi per pekerjaan, BR-10) |
| Konfirmasi | `Konfirmasi` | Laporan 0..N (lihat catatan) |
| PengajuanSukuCadang | `PengajuanSukuCadang` | Laporan 0..N |
| *(tambahan)* | `User` | akun login & peran (NFR-05/06) |

## Siklus status laporan

```
BARU ──tugaskan──▶ DITUGASKAN ──progres──▶ DIKERJAKAN ──selesai teknisi──▶ MENUNGGU_KONFIRMASI
  ▲                                         │   ▲                              │
  │                          pengajuan>500rb▼   │ditindaklanjuti               ├─ SELESAI (dikonfirmasi pelapor)
  │                                       DITAHAN                              ├─ SELESAI_OTOMATIS (3 hari tanpa tanggapan)
  └──────────── DIBUKA_KEMBALI ◀──── pelapor: belum selesai ───────────────────┘
```

## Endpoint

Semua endpoint (kecuali login/health) memerlukan header `Authorization: Bearer <token>`.
Respons: `{ success, message, data }`; error: `{ success:false, message, details? }` (NFR-11).

### Auth
| Method | Path | Peran |
|---|---|---|
| POST | `/api/auth/login` | publik |
| GET | `/api/auth/me` | semua |
| POST | `/api/auth/ganti-password` | semua |

### Referensi
| GET | `/api/referensi` | enum (sumber, prioritas, status, bidang), ambang Rp500.000 |
|---|---|---|
| GET | `/api/sla/pratinjau?prioritas=DARURAT` | pratinjau target SLA (REQ-05) |

### Master data — `/api/master`
`gedung`, `ruang?gedungId=`, `jenis-kerusakan`, `teknisi?bidang=&aktif=`, `pelapor?q=`, `users` — GET untuk internal, POST/PUT/DELETE khusus ADMIN.

### Laporan — `/api/laporan`
| Method | Path | Peran | SRS |
|---|---|---|---|
| GET | `/` (filter: `status, prioritas, gedungId, jenisId, teknisiId, belumSelesai, terlambat, dari, sampai, q, page, limit`) | semua (dibatasi per peran) | REQ-21 |
| GET | `/:id` (detail + riwayat, penugasan, jam kerja, konfirmasi, pengajuan) | sesuai akses | REQ-08, REQ-21 |
| POST | `/` *multipart*: `foto`, `sumberLaporan`, `ruangId`, `jenisId`, `deskripsi`, `prioritas?`, `pelaporId` / `pelaporNama`+`pelaporKontak` | ADMIN | REQ-01..03, UC-03 |
| PUT | `/:id`, `/:id/foto` | ADMIN | |
| PATCH | `/:id/prioritas` `{prioritas}` | ADMIN | REQ-04, REQ-05 |
| POST | `/:id/penugasan` `{teknisiIds:[..]}` | ADMIN | REQ-06, REQ-07, UC-04 |
| DELETE | `/:id/penugasan/:penugasanId` | ADMIN | pengalihan |
| POST | `/:id/perkembangan` `{jenis: PROGRES/PEMERIKSAAN/PERBAIKAN, catatan}` | TEKNISI (ditugaskan), ADMIN | REQ-10, UC-05 |
| PATCH | `/:id/status` `{status: DIKERJAKAN/MENUNGGU_KONFIRMASI, catatan}` | TEKNISI, ADMIN | REQ-09 |
| POST | `/:id/selesai-teknisi` `{catatan}` | TEKNISI, ADMIN | UC-06, BR-12 |
| POST | `/:id/konfirmasi` `{hasil: SELESAI/BELUM_SELESAI/TIDAK_ADA_TANGGAPAN, catatan, teknisiIds?}` | ADMIN, PELAPOR (miliknya) | REQ-12..14 |
| POST | `/:id/buka-kembali` `{catatan, teknisiIds?}` | ADMIN | REQ-13, UC-11 |
| POST | `/:id/pengajuan` `{namaBarang, nilai(>500000), catatan}` | ADMIN | REQ-19, REQ-20 |

### Pekerjaan teknisi, jam kerja, pengajuan — `/api`
| Method | Path | Peran | SRS |
|---|---|---|---|
| GET | `/pekerjaan-saya?status=aktif\|selesai\|semua` | TEKNISI | REQ-08, UC-10 |
| GET/POST | `/penugasan/:id/jam-kerja` `{durasiJam, tanggal?, catatan?}` | TEKNISI (miliknya), ADMIN | REQ-11, UC-07 |
| DELETE | `/jam-kerja/:id` | TEKNISI (miliknya), ADMIN | |
| GET | `/pengajuan?status=MENUNGGU` | ADMIN, KEUANGAN, KEPALA_UNIT | UC-09 |
| PATCH | `/pengajuan/:id/tindak-lanjut` `{catatan}` | ADMIN, KEUANGAN | REQ-20 |

### Manajemen — `/api/manajemen` (ADMIN, KEPALA_UNIT)
| GET | `/dashboard` | ringkasan + `peringatanTerlambat` | REQ-15, UC-08 |
|---|---|---|---|
| GET | `/belum-selesai` | | REQ-16 |
| GET | `/terlambat?termasukSelesai=` | | REQ-15, REQ-16 |
| GET | `/laporan-bulanan?bulan=YYYY-MM` | per gedung, per jenis, matriks, rincian | REQ-17, UC-12 |
| GET | `/rekap-jam-kerja?bulan=&teknisiId=&laporanId=` | per teknisi & per pekerjaan | REQ-18, UC-13 |
| POST | `/auto-close/jalankan` | (ADMIN) jalankan penutupan otomatis | REQ-14 |

## Asumsi untuk poin SRS yang "belum dikonfirmasi"

Semua bisa diubah lewat `.env` atau `src/utils/sla.js`:

| Poin terbuka | Keputusan default |
|---|---|
| Titik awal SLA (REQ-05) | `tanggalLapor` (saat laporan dicatat/diterima) |
| Satuan hari prioritas Tinggi | 24 jam kalender; Normal = 3 hari kerja (Sen–Jum); Darurat = 4 jam kalender, termasuk malam/libur (BR-18) |
| Laporan tanpa foto (BR-03) | Ditolak; set `WAJIB_FOTO=false` untuk mengizinkan |
| Auto-close 3 hari (REQ-14) | Otomatis oleh scheduler tiap 60 menit, dihitung sejak teknisi menyatakan selesai, hari kalender (`AUTO_CLOSE_MODE=kerja` untuk hari kerja). Admin juga bisa mencatat `TIDAK_ADA_TANGGAPAN` secara manual |
| Ambang Rp500.000 (BR-11) | Per pengajuan (per barang); nilai ≤ 500.000 ditolak |
| Keputusan Bagian Keuangan | Tidak dimodelkan sebagai setuju/tolak; hanya `MENUNGGU` → `DITINDAKLANJUTI` + catatan. Pekerjaan kembali ke status sebelum ditahan |
| Pengaruh penahanan pada SLA | Tidak menghentikan hitungan SLA |
| Metode jam kerja (REQ-11) | Input total durasi (jam desimal) per tanggal, per teknisi per penugasan |
| Akses Pelapor | Opsional: melihat laporannya sendiri & memberi konfirmasi; alur utama tetap melalui Admin |
| ERD Konfirmasi 0..1 | Diubah menjadi 0..N agar riwayat tersimpan saat laporan dibuka kembali (US-11) |

## Deploy ke URL publik (NFR-03)

1. Ubah `provider = "postgresql"` di `prisma/schema.prisma`.
2. Set env `DATABASE_URL` (PostgreSQL dari Railway/Neon/Supabase), `JWT_SECRET`, `TZ=Asia/Makassar`, `CORS_ORIGIN=<url frontend>`.
3. Build: `npm install` · Start: `npm run setup && npm start` (setup cukup sekali).
4. Folder `uploads/` butuh disk persisten (Railway volume) — atau ganti ke penyimpanan objek.
