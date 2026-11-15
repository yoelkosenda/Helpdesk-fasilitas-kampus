# Test Case Matrix — Sistem Helpdesk Fasilitas Kampus

Dokumen ini berisi daftar *test case* Quality Assurance (QA) berdasarkan spesifikasi SRS (`REQ-01..21`, `BR-01..18`, `NFR`) serta implementasi aktual backend (`src/`) dan frontend (`frontend/src/main.jsx`).

**Akun Uji Seed (`prisma/seed.js`):**
- `admin` (`ADMIN`) · `kepala` (`KEPALA_UNIT`) · `keuangan` (`KEUANGAN`) · `pelapor` (`PELAPOR`)
- `teknisi.listrik`, `teknisi.ac`, `teknisi.bangunan`, `teknisi.air` (`TEKNISI`)

---

## 1. Autentikasi, Keamanan & RBAC (`NFR-04`, `NFR-05`, `NFR-06`, `NFR-11`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-AUTH-01** | Login berhasil | Semua | `POST /api/auth/login` · Login | Masukkan `username` dan `password` valid | Status `200`, token JWT & data `user` dikembalikan; redirect ke dashboard sesuai role | Automated (`api.test.js`) |
| **TC-AUTH-02** | Login gagal (password/username salah) | Publik | `POST /api/auth/login` · Login | Masukkan `username: "admin"`, `password: "salah"` | Status `401`, pesan `"Username atau password salah"` tampil rapi di UI | Automated (`api.test.js`) |
| **TC-AUTH-03** | Login akun nonaktif | Semua | `POST /api/auth/login` | Login dengan user `aktif: false` | Status `401`, akses ditolak | Automated (`api.test.js`) |
| **TC-AUTH-04** | Akses endpoint tanpa token / token invalid | Publik | `GET /api/laporan` | Request tanpa header `Authorization` atau token rusak | Status `401 Unauthorized` | Automated (`api.test.js`) |
| **TC-AUTH-05** | Ganti password valid & salah password lama | Semua | `POST /api/auth/ganti-password` · Profil | 1) Input `passwordLama` salah<br>2) Input `passwordLama` benar & `passwordBaru` min 6 char | 1) `400` `"Password lama salah"`<br>2) `200` `"Password berhasil diganti"`, login ulang pakai password baru berhasil | Automated (`api.test.js`) |
| **TC-RBAC-01** | Pembatasan akses endpoint Admin | `KEPALA_UNIT`, `TEKNISI`, `KEUANGAN`, `PELAPOR` | `POST /api/laporan`, `POST /api/master/*`, `POST /api/manajemen/auto-close/jalankan` | Coba akses endpoint khusus `ADMIN` dengan token role lain | Status `403 Forbidden` | Sebagian di `api.test.js` (`kepala` → `POST /api/laporan`) |
| **TC-RBAC-02** | Pembatasan akses Manajemen | `TEKNISI`, `KEUANGAN`, `PELAPOR` | `GET /api/manajemen/dashboard` | Akses dashboard manajemen tanpa role `ADMIN`/`KEPALA_UNIT` | Status `403 Forbidden` | Automated (`api.test.js`) |
| **TC-RBAC-03** | Pelapor hanya melihat laporannya sendiri | `PELAPOR` | `GET /api/laporan`, `GET /api/laporan/:id` | 1) List laporan<br>2) Akses `:id` milik pelapor lain | 1) Hanya tampil laporan `pelaporId` miliknya<br>2) `403 Forbidden` | Sebagian di `api.test.js` |
| **TC-RBAC-04** | Teknisi hanya melihat & mengubah laporan yang ditugaskan | `TEKNISI` | `GET /api/laporan/:id`, `POST /api/laporan/:id/perkembangan` | Teknisi A mengakses/mengisi progres laporan yang hanya ditugaskan ke Teknisi B | Status `403 Forbidden` | Automated (`api.test.js`) |

---

## 2. Pencatatan Laporan, Upload Foto & Update (`REQ-01..03`, `BR-01`, `BR-03`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-LAP-01** | Catat laporan baru dengan foto (pelapor baru) | `ADMIN` | `POST /api/laporan` · Modal Catat Laporan | Multipart: `sumberLaporan` (`WHATSAPP`/`TELEPON`/`DATANG_LANGSUNG`), `ruangId`, `jenisId`, `pelaporNama`, `deskripsi`, `foto` (PNG/JPG) | Status `201`, kode unik `LPR-YYYYMM-XXXX`, status `BARU`, `fotoUrl` valid & bisa diakses via `/uploads/...` | Automated (`api.test.js`) |
| **TC-LAP-02** | Tolak laporan tanpa foto saat `WAJIB_FOTO=true` (`BR-03`) | `ADMIN` | `POST /api/laporan` | Kirim payload valid tanpa field `foto` | Status `400`, pesan `"Foto kerusakan wajib dilampirkan (BR-03)"` | Automated (`api.test.js`) |
| **TC-LAP-03** | Validasi format & ukuran file foto (`upload.js`) | `ADMIN` | `POST /api/laporan`, `PUT /api/laporan/:id/foto` | 1) Upload file non-gambar (`.pdf`/`.txt`)<br>2) Upload gambar `> 5MB` | 1) `400` `"Foto harus berformat JPG, PNG, WEBP, atau HEIC"`<br>2) `400` `"Ukuran foto melebihi batas"` | Sebagian di `api.test.js` (format non-gambar) |
| **TC-LAP-04** | Update data laporan (`PUT /api/laporan/:id`) | `ADMIN` | `PUT /api/laporan/:id` | 1) Update `deskripsi` pada laporan aktif<br>2) Update dengan `ruangId` / `jenisId` tidak ada | 1) Status `200`<br>2) Status `400` `"Ruang tidak ditemukan"` / `"Jenis kerusakan tidak ditemukan"` | Automated (`api.test.js`) |
| **TC-LAP-05** | Tolak ubah laporan/foto setelah berstatus final | `ADMIN` | `PUT /api/laporan/:id`, `PUT /api/laporan/:id/foto` | Coba edit data atau ganti foto pada laporan `SELESAI` / `SELESAI_OTOMATIS` | Status `409 Conflict` `"Laporan sudah selesai/ditutup"` & file upload tidak tertinggal | Automated (`api.test.js`) |
| **TC-LAP-06** | Filter & pencarian daftar laporan (`REQ-21`) | `ADMIN`, `KEPALA_UNIT` | `GET /api/laporan?...` · Halaman Laporan | Filter by `status` (termasuk multi-status koma), `prioritas`, `terlambat=true`, `q` | Data terfilter sesuai parameter; pagination `meta` akurat | Manual / Sebagian |

---

## 3. Prioritas & Perhitungan SLA (`REQ-04`, `REQ-05`, `BR-05`, `BR-18`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-SLA-01** | Target SLA `DARURAT` (+4 jam kalender 24/7) | `ADMIN` | `PATCH /api/laporan/:id/prioritas` | Set `prioritas: "DARURAT"` (termasuk malam/akhir pekan) | `targetSla = tanggalLapor + 4 jam`, `labelSla: "4 jam"` | Automated (`api.test.js`) |
| **TC-SLA-02** | Target SLA `TINGGI` (+24 jam kalender) | `ADMIN` | `PATCH /api/laporan/:id/prioritas` | Set `prioritas: "TINGGI"` | `targetSla = tanggalLapor + 24 jam`, `labelSla: "1 hari"` | Automated (`api.test.js`) |
| **TC-SLA-03** | Target SLA `NORMAL` (+3 hari kerja, lewati Sabtu–Minggu) | `ADMIN` | `PATCH /api/laporan/:id/prioritas`, `GET /api/sla/pratinjau` | Set `prioritas: "NORMAL"` pada hari Kamis/Jumat | `targetSla` melewati Sabtu & Minggu (Senin/Selasa), `labelSla: "3 hari kerja"` | Automated (`api.test.js`) |
| **TC-SLA-04** | Deteksi keterlambatan SLA (`REQ-15`) | `ADMIN`, `KEPALA_UNIT` | `GET /api/manajemen/dashboard`, `GET /api/manajemen/terlambat` | Laporan `DARURAT` dengan `tanggalLapor` > 4 jam lalu dan belum selesai | `terlambat: true`, muncul di `peringatanTerlambat` & daftar terlambat | Automated (`api.test.js`) |

---

## 4. Penugasan Multi-Teknisi & Pekerjaan Teknisi (`REQ-06..11`, `BR-09`, `BR-10`, `BR-12`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-TUGAS-01** | Penugasan multi-teknisi & peringatan lintas bidang (`BR-09`) | `ADMIN` | `POST /api/laporan/:id/penugasan` · Detail Laporan | Tugaskan teknisi bidang sama + teknisi bidang berbeda pada laporan `BARU` | Status `201`, status laporan jadi `DITUGASKAN`, `teknisiAktif` bertambah, `peringatan` muncul untuk teknisi beda bidang | Automated (`api.test.js`) |
| **TC-TUGAS-02** | Tolak penugasan teknisi nonaktif atau duplikat | `ADMIN` | `POST /api/laporan/:id/penugasan` | Tugaskan teknisi `aktif: false` atau yang sudah aktif di laporan sama | `400` untuk nonaktif; `409` jika semua sudah ditugaskan | Automated (`api.test.js`) |
| **TC-TUGAS-03** | Batalkan penugasan teknisi terakhir | `ADMIN` | `DELETE /api/laporan/:id/penugasan/:penugasanId` | Batalkan satu-satunya penugasan aktif | `statusTugas: "DIBATALKAN"`, status laporan kembali ke `BARU` | Automated (`api.test.js`) |
| **TC-KERJA-01** | Teknisi lihat pekerjaan saya (`aktif`, `selesai`, `semua`) | `TEKNISI` | `GET /api/pekerjaan-saya?status=...` · Pekerjaan Saya | Buka tab Aktif, Selesai, Semua | Terurut `DARURAT > TINGGI > NORMAL` lalu `targetSla`; kolom "Jam saya" menampilkan `totalJamSaya` | Sebagian (`api.test.js`) |
| **TC-KERJA-02** | Catat perkembangan (`PROGRES`, `PEMERIKSAAN`, `PERBAIKAN`) | `TEKNISI` | `POST /api/laporan/:id/perkembangan` · Detail Laporan | Isi catatan progres (bukan spasi kosong) | Status berubah `DITUGASKAN → DIKERJAKAN`; timeline menampilkan waktu (`x.waktu`) & nama user | Automated (`api.test.js`) |
| **TC-KERJA-03** | Catat & hapus jam kerja individual (`BR-10`) | `TEKNISI`, `ADMIN` | `POST /api/penugasan/:id/jam-kerja`, `DELETE /api/jam-kerja/:id` | 1) Input `durasiJam: 2.5`<br>2) Input `0`, `25`, atau tanggal masa depan<br>3) Input pada laporan `SELESAI` | 1) `201` tersimpan<br>2) `400` ditolak<br>3) `409` ditolak | Sebagian (`api.test.js`) |
| **TC-KERJA-04** | Teknisi nyatakan pekerjaan selesai (`BR-12`) | `TEKNISI` | `POST /api/laporan/:id/selesai-teknisi`, `PATCH /api/laporan/:id/status` | Kirim catatan penyelesaian pada laporan `DIKERJAKAN` | Status jadi `MENUNGGU_KONFIRMASI`, `tglSelesaiTeknisi` terisi | Automated (`api.test.js`) |

---

## 5. Suku Cadang `> Rp500.000` & Status `DITAHAN` (`REQ-19`, `REQ-20`, `BR-11`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-PART-01** | Tolak pengajuan suku cadang `<= Rp500.000` (`BR-11`) | `ADMIN` | `POST /api/laporan/:id/pengajuan` · Pengajuan Suku Cadang | Input `nilai: 500000` | Status `400` (ditolak validasi backend & form frontend) | Automated (`api.test.js`) |
| **TC-PART-02** | Pengajuan `> Rp500.000` menahan laporan (`DITAHAN`) | `ADMIN` | `POST /api/laporan/:id/pengajuan` | Input `namaBarang: "Panel MCB"`, `nilai: 1750000` | Status `201`, laporan menjadi `DITAHAN`, teknisi tidak bisa `selesai-teknisi` (`409`) | Automated (`api.test.js`) |
| **TC-PART-03** | Tindak lanjut Keuangan mengembalikan status laporan | `KEUANGAN`, `ADMIN` | `PATCH /api/pengajuan/:id/tindak-lanjut` · Pengajuan | Isi catatan tindak lanjut pada pengajuan `MENUNGGU` | Status pengajuan `DITINDAKLANJUTI`; jika tidak ada pengajuan menunggu lain, laporan kembali ke `statusSebelumDitahan` | Automated (`api.test.js`) |

---

## 6. Konfirmasi Pelapor, Buka Kembali & Auto-Close (`REQ-12`, `REQ-13`, `REQ-14`, `BR-13`, `BR-14`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-CONF-01** | Pelapor/Admin konfirmasi `SELESAI` | `PELAPOR`, `ADMIN` | `POST /api/laporan/:id/konfirmasi` · Detail Laporan | Pilih `SELESAI` pada laporan `MENUNGGU_KONFIRMASI` | Status menjadi `SELESAI`, `tglDitutup` terisi, penugasan aktif menjadi `SELESAI` | Automated (`api.test.js`) |
| **TC-CONF-02** | Pelapor/Admin nyatakan `BELUM_SELESAI` (`BR-13`) | `PELAPOR`, `ADMIN` | `POST /api/laporan/:id/konfirmasi`, `POST /api/laporan/:id/buka-kembali` | Pilih `BELUM_SELESAI` (opsional `teknisiIds` oleh Admin) | Status menjadi `DIBUKA_KEMBALI` (atau `DITUGASKAN` jika langsung pilih teknisi), `tglSelesaiTeknisi` di-reset `null`, riwayat `Konfirmasi` tersimpan | Automated (`api.test.js`) |
| **TC-CONF-03** | Tolak `TIDAK_ADA_TANGGAPAN` sebelum 3 hari | `ADMIN` | `POST /api/laporan/:id/konfirmasi` | Kirim `hasil: "TIDAK_ADA_TANGGAPAN"` saat `< 3 hari` dari `tglSelesaiTeknisi` | Status `409 Conflict` | Automated (`api.test.js`) |
| **TC-CONF-04** | Auto-close setelah 3 hari tanpa tanggapan (`BR-14`) | `ADMIN` / Scheduler | `POST /api/manajemen/auto-close/jalankan` | Laporan `MENUNGGU_KONFIRMASI` dengan `tglSelesaiTeknisi` > 3 hari lalu | Status menjadi `SELESAI_OTOMATIS`, tercatat konfirmasi `TIDAK_ADA_TANGGAPAN` | Automated (`api.test.js`) |

---

## 7. Laporan Manajemen & Data Master (`REQ-16`, `REQ-17`, `REQ-18`, `REQ-21`)

| ID | Skenario | Peran | Endpoint / Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|---|
| **TC-MGT-01** | Laporan bulanan per gedung & jenis (`REQ-17`) | `ADMIN`, `KEPALA_UNIT` | `GET /api/manajemen/laporan-bulanan?bulan=YYYY-MM` | 1) Bulan berisi data<br>2) Bulan kosong (`2000-01`) | 1) Agregasi `perGedung`, `perJenis`, `matriks`, `rincian` akurat<br>2) `total: 0`, pesan `"Data tidak tersedia untuk periode ini"` | Automated (`api.test.js`) |
| **TC-MGT-02** | Rekap jam kerja per teknisi & pekerjaan (`REQ-18`) | `ADMIN`, `KEPALA_UNIT` | `GET /api/manajemen/rekap-jam-kerja` | Filter per bulan / teknisi / laporan | `totalJam` dan `jumlahPekerjaan` sesuai catatan `JamKerja` | Automated (`api.test.js`) |
| **TC-MST-01** | CRUD Data Master (`gedung`, `ruang`, `jenis-kerusakan`, `teknisi`, `users`) | `ADMIN` | `/api/master/*` · Halaman Data Master | Tambah, ubah, nonaktifkan akun/teknisi; cek penolakan nonaktifkan akun sendiri | Operasi berhasil (`200`/`201`); nonaktifkan akun sendiri ditolak `400` | Sebagian di `api.test.js` (`users`, `teknisi`, `aktif`) |

---

## 8. Pengujian UI/UX & Responsivitas (`NFR-01`, `NFR-03`)

| ID | Skenario | Halaman | Langkah & Input | Expected Result | Cakupan Saat Ini |
|---|---|---|---|---|---|
| **TC-UI-01** | Navigasi cepat & tombol Kembali per role | Dashboard, Detail | 1) Admin klik "Catat laporan" di Dashboard<br>2) Teknisi buka detail lalu klik "Kembali" | 1) Modal `ReportForm` terbuka<br>2) Teknisi kembali ke `Pekerjaan Saya` | Manual (baru diperbaiki di PR #4) |
| **TC-UI-02** | Tampilan mobile / layar sempit | Semua halaman | Uji viewport `375x812` | Sidebar collapse rapi, tabel dapat di-scroll horizontal, modal tetap terbaca | Manual |
| **TC-UI-03** | Build produksi frontend | `frontend/` | Jalankan `npm run build` | Build Vite selesai tanpa error | Terverifikasi (`dist/` terbangun) |
