-- =========================================================================
-- FILE 1: SCHEMA.SQL (STRUKTUR DATABASE MYSQL / MARIADB)
-- Proyek : Helpdesk Fasilitas Kampus — Tim 1 (gacor)
-- Acuan  : PRD Tahap 4 & Dokumen Desain Sistem (Revisi Sinkronisasi UI)
-- =========================================================================

CREATE DATABASE IF NOT EXISTS helpdesk_fasilitas_kampus
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE helpdesk_fasilitas_kampus;

-- Safe bootstrap: this script never drops, truncates, or rewrites existing data.
-- Existing tables are left untouched; review any schema evolution as a migration.

-- 1. Tabel PENGGUNA (Akun internal: Admin, Teknisi, Kepala Unit, Keuangan)
CREATE TABLE IF NOT EXISTS pengguna (
    id_pengguna CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    nama VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'TEKNISI', 'KEPALA_UNIT', 'KEUANGAN') NOT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabel PELAPOR (Non-login, identitas opsional sesuai PRD 8.3.B & Screen A.1)
CREATE TABLE IF NOT EXISTS pelapor (
    id_pelapor CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    nama VARCHAR(120) NULL,
    kontak VARCHAR(50) NULL,
    asal_kelompok VARCHAR(50) NULL
) ENGINE=InnoDB;

-- 3. Tabel GEDUNG (8 Gedung Kampus - BR-01)
CREATE TABLE IF NOT EXISTS gedung (
    id_gedung CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    nama_gedung VARCHAR(120) NOT NULL,
    kode_gedung VARCHAR(30) NULL UNIQUE
) ENGINE=InnoDB;

-- 4. Tabel RUANG (Relasi 1:M dari Gedung)
CREATE TABLE IF NOT EXISTS ruang (
    id_ruang CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_gedung CHAR(36) NOT NULL,
    nama_nomor_ruang VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_gedung_ruang (id_gedung, nama_nomor_ruang),
    CONSTRAINT fk_ruang_gedung FOREIGN KEY (id_gedung)
        REFERENCES gedung(id_gedung) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 5. Tabel JENIS_KERUSAKAN (Listrik, AC, Bangunan, Air - BR-01 & BR-02)
CREATE TABLE IF NOT EXISTS jenis_kerusakan (
    id_jenis CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    nama_jenis ENUM('Listrik', 'AC', 'Bangunan', 'Air') NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 6. Tabel TEKNISI (Profil teknisi 1:1 ke Pengguna - PRD 8.3.F)
CREATE TABLE IF NOT EXISTS teknisi (
    id_teknisi CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_pengguna CHAR(36) NOT NULL UNIQUE,
    bidang_keahlian ENUM('Listrik', 'AC', 'Bangunan dan Air') NOT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_teknisi_pengguna FOREIGN KEY (id_pengguna)
        REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 7. Tabel LAPORAN (Entitas utama tiket kerusakan - PRD 8.3.G & Screen A.1/A.3)
CREATE TABLE IF NOT EXISTS laporan (
    id_laporan CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    nomor_tiket VARCHAR(30) NOT NULL UNIQUE,
    id_pelapor CHAR(36) NULL,
    id_ruang CHAR(36) NOT NULL,
    id_jenis CHAR(36) NOT NULL,
    dicatat_oleh CHAR(36) NOT NULL,
    tanggal_lapor TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sumber_laporan ENUM('WHATSAPP', 'TELEPON', 'DATANG_LANGSUNG') NOT NULL,
    deskripsi TEXT NOT NULL,
    foto_key VARCHAR(500) NULL,
    prioritas ENUM('DARURAT', 'TINGGI', 'NORMAL') NOT NULL,
    target_sla VARCHAR(50) NOT NULL,
    sla_started_at DATETIME NULL,
    sla_deadline_at DATETIME NULL,
    is_paused TINYINT(1) NOT NULL DEFAULT 0,
    waktu_mulai_pause DATETIME NULL,
    total_pause_menit INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM(
        'DITERIMA',
        'DITUGASKAN',
        'DALAM_PENANGANAN',
        'DITAHAN',
        'MENUNGGU_KONFIRMASI',
        'DIBUKA_KEMBALI',
        'SELESAI'
    ) NOT NULL DEFAULT 'DITERIMA',
    selesai_teknisi_at DATETIME NULL,
    tgl_tutup DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_laporan_tanggal (tanggal_lapor),
    KEY idx_laporan_status (status),
    KEY idx_laporan_prioritas (prioritas),
    KEY idx_laporan_ruang (id_ruang),
    KEY idx_laporan_jenis (id_jenis),

    CONSTRAINT fk_laporan_pelapor FOREIGN KEY (id_pelapor) REFERENCES pelapor(id_pelapor) ON DELETE SET NULL,
    CONSTRAINT fk_laporan_ruang FOREIGN KEY (id_ruang) REFERENCES ruang(id_ruang) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_jenis FOREIGN KEY (id_jenis) REFERENCES jenis_kerusakan(id_jenis) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pencatat FOREIGN KEY (dicatat_oleh) REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Tabel PENUGASAN (Multi-teknisi 1:M - PRD 8.3.H, UC-04 & Screen A.2)
CREATE TABLE IF NOT EXISTS penugasan (
    id_penugasan CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_laporan CHAR(36) NOT NULL,
    id_teknisi CHAR(36) NOT NULL,
    ditugaskan_oleh CHAR(36) NOT NULL,
    tanggal_penugasan TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_penugasan ENUM('DITUGASKAN', 'DALAM_PENANGANAN', 'SELESAI', 'DIBATALKAN') NOT NULL DEFAULT 'DITUGASKAN',
    catatan_penugasan TEXT NULL,

    KEY idx_penugasan_teknisi (id_teknisi),
    KEY idx_penugasan_laporan (id_laporan),

    CONSTRAINT fk_penugasan_laporan_restrict FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan) ON DELETE RESTRICT,
    CONSTRAINT fk_penugasan_teknisi FOREIGN KEY (id_teknisi) REFERENCES teknisi(id_teknisi) ON DELETE RESTRICT,
    CONSTRAINT fk_penugasan_admin FOREIGN KEY (ditugaskan_oleh) REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 9. Tabel PERKEMBANGAN (Riwayat progres & bukti foto lapangan - PRD 8.3.I & Screen T.2)
CREATE TABLE IF NOT EXISTS perkembangan (
    id_perkembangan CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_penugasan CHAR(36) NOT NULL,
    status VARCHAR(40) NOT NULL,
    hasil_pemeriksaan TEXT NULL,
    tindakan_perbaikan TEXT NULL,
    catatan TEXT NULL,
    foto_bukti_key VARCHAR(500) NULL,
    dicatat_oleh CHAR(36) NOT NULL,
    dicatat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_perkembangan_penugasan (id_penugasan),
    KEY idx_perkembangan_dicatat_pada (dicatat_pada),

    CONSTRAINT fk_perkembangan_penugasan_restrict FOREIGN KEY (id_penugasan) REFERENCES penugasan(id_penugasan) ON DELETE RESTRICT,
    CONSTRAINT fk_perkembangan_pencatat FOREIGN KEY (dicatat_oleh) REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 10. Tabel JAM_KERJA (Log jam individual per penugasan - PRD 8.3.J)
CREATE TABLE IF NOT EXISTS jam_kerja (
    id_jam_kerja CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_penugasan CHAR(36) NOT NULL,
    tanggal_kerja DATE NOT NULL,
    total_jam DECIMAL(6,2) NOT NULL,
    catatan TEXT NULL,
    dicatat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_jam_kerja_penugasan (id_penugasan),
    KEY idx_jam_kerja_tanggal (tanggal_kerja),

    CONSTRAINT chk_total_jam_positif CHECK (total_jam > 0),
    CONSTRAINT fk_jam_penugasan_restrict FOREIGN KEY (id_penugasan) REFERENCES penugasan(id_penugasan) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 11. Tabel KONFIRMASI (Relasi 1:M dari Laporan untuk jejak reopen - PRD 8.3.K)
CREATE TABLE IF NOT EXISTS konfirmasi (
    id_konfirmasi CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_laporan CHAR(36) NOT NULL,
    dicatat_oleh CHAR(36) NOT NULL,
    hasil ENUM('SELESAI', 'BELUM_SELESAI', 'TIDAK_ADA_TANGGAPAN') NOT NULL,
    kanal ENUM('WHATSAPP', 'TELEPON', 'DATANG_LANGSUNG', 'SISTEM') NULL,
    catatan TEXT NULL,
    tanggal_konfirmasi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_konfirmasi_laporan_restrict FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan) ON DELETE RESTRICT,
    CONSTRAINT fk_konfirmasi_pencatat FOREIGN KEY (dicatat_oleh) REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 12. Tabel PENGAJUAN_SUKU_CADANG (> Rp500.000 - PRD 8.3.L & BR-11)
CREATE TABLE IF NOT EXISTS pengajuan_suku_cadang (
    id_pengajuan CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    id_laporan CHAR(36) NOT NULL,
    dicatat_oleh CHAR(36) NOT NULL,
    uraian_kebutuhan TEXT NOT NULL,
    nilai_pengajuan DECIMAL(14,2) NOT NULL,
    status_pengajuan VARCHAR(40) NOT NULL DEFAULT 'MENUNGGU_TINDAK_LANJUT',
    tanggal_pengajuan TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    catatan TEXT NULL,

    KEY idx_pengajuan_laporan (id_laporan),
    KEY idx_pengajuan_status (status_pengajuan),

    CONSTRAINT chk_nilai_suku_cadang CHECK (nilai_pengajuan > 500000.00),
    CONSTRAINT fk_pengajuan_laporan_restrict FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan) ON DELETE RESTRICT,
    CONSTRAINT fk_pengajuan_pencatat FOREIGN KEY (dicatat_oleh) REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
) ENGINE=InnoDB;
