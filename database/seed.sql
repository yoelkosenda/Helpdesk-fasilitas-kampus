-- =========================================================================
-- FILE 2: SEED.SQL (DATA MASTER & AKUN UJI AWAL)
-- Jalankan file ini SETELAH menjalankan schema.sql
-- Acuan: PRD Bagian 8.5 & Dokumen Desain NFR-04
-- =========================================================================

USE helpdesk_fasilitas_kampus;

-- Idempotent and non-destructive: duplicate IDs/natural keys are no-op updates.
-- This seeder never deletes or changes existing master, user, or operational data.

-- 1. Master Jenis Kerusakan (4 Bidang Sarpras - BR-01)
INSERT INTO jenis_kerusakan (nama_jenis) VALUES
('Listrik'),
('AC'),
('Bangunan'),
('Air')
ON DUPLICATE KEY UPDATE nama_jenis = nama_jenis;

-- 2. Master 8 Gedung Kampus (BR-01)
INSERT INTO gedung (id_gedung, nama_gedung, kode_gedung) VALUES
('11111111-1111-1111-1111-111111111101', 'Gedung A', 'GD-A'),
('11111111-1111-1111-1111-111111111102', 'Gedung B', 'GD-B'),
('11111111-1111-1111-1111-111111111103', 'Gedung C', 'GD-C'),
('11111111-1111-1111-1111-111111111104', 'Gedung D', 'GD-D'),
('11111111-1111-1111-1111-111111111105', 'Gedung E', 'GD-E'),
('11111111-1111-1111-1111-111111111106', 'Gedung F', 'GD-F'),
('11111111-1111-1111-1111-111111111107', 'Gedung G', 'GD-G'),
('11111111-1111-1111-1111-111111111108', 'Gedung H', 'GD-H')
ON DUPLICATE KEY UPDATE nama_gedung = nama_gedung;

-- 3. Contoh Master Ruang per Gedung
INSERT INTO ruang (id_gedung, nama_nomor_ruang) VALUES
('11111111-1111-1111-1111-111111111101', 'Ruang 101'),
('11111111-1111-1111-1111-111111111102', 'Ruang 202'),
('11111111-1111-1111-1111-111111111102', 'Ruang Dosen 302')
ON DUPLICATE KEY UPDATE nama_nomor_ruang = nama_nomor_ruang;

-- 4. Akun uji internal. Passwords are stored as bcrypt hashes; no plaintext is seeded.
-- Existing accounts with these IDs/usernames are preserved unchanged.
INSERT INTO pengguna (id_pengguna, nama, username, password_hash, role) VALUES
('22222222-2222-2222-2222-222222222201', 'Ibu Vonny', 'admin_vonny', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'ADMIN'),
('22222222-2222-2222-2222-222222222202', 'Pak Jefry Sumual', 'kepala_jefry', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'KEPALA_UNIT'),
('22222222-2222-2222-2222-222222222203', 'Staf Keuangan', 'keuangan_kampus', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'KEUANGAN'),
('22222222-2222-2222-2222-222222222204', 'Joko Susilo', 'teknisi_listrik_1', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI'),
('22222222-2222-2222-2222-222222222205', 'Hendra Wijaya', 'teknisi_listrik_2', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI'),
('22222222-2222-2222-2222-222222222206', 'Rudi Hartono', 'teknisi_ac_1', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI'),
('22222222-2222-2222-2222-222222222207', 'Doni Prasetyo', 'teknisi_ac_2', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI'),
('22222222-2222-2222-2222-222222222208', 'Agus Setiawan', 'teknisi_bangunan_1', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI'),
('22222222-2222-2222-2222-222222222209', 'Bambang Sujarwo', 'teknisi_bangunan_2', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'TEKNISI')
ON DUPLICATE KEY UPDATE username = username;

-- 5. Profil Bidang Keahlian 6 Teknisi (2 Listrik, 2 AC, 2 Bangunan dan Air)
INSERT INTO teknisi (id_pengguna, bidang_keahlian) VALUES
('22222222-2222-2222-2222-222222222204', 'Listrik'),
('22222222-2222-2222-2222-222222222205', 'Listrik'),
('22222222-2222-2222-2222-222222222206', 'AC'),
('22222222-2222-2222-2222-222222222207', 'AC'),
('22222222-2222-2222-2222-222222222208', 'Bangunan dan Air'),
('22222222-2222-2222-2222-222222222209', 'Bangunan dan Air')
ON DUPLICATE KEY UPDATE id_pengguna = id_pengguna;
