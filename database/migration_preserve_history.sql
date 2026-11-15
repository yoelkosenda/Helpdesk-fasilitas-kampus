-- One-time upgrade for databases created with the earlier schema.sql.
-- Replace CASCADE delete rules so deleting a report/assignment cannot erase
-- work logs, progress, confirmations, or parts requests. No rows are changed.
-- Run only after verifying the current foreign-key names with SHOW CREATE TABLE.
-- Target: helpdesk_fasilitas_kampus (MariaDB 10.4+ / MySQL 8+).

USE helpdesk_fasilitas_kampus;

ALTER TABLE penugasan
    DROP FOREIGN KEY fk_penugasan_laporan,
    ADD CONSTRAINT fk_penugasan_laporan_restrict
        FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE perkembangan
    DROP FOREIGN KEY fk_perkembangan_penugasan,
    ADD CONSTRAINT fk_perkembangan_penugasan_restrict
        FOREIGN KEY (id_penugasan) REFERENCES penugasan(id_penugasan)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE jam_kerja
    DROP FOREIGN KEY fk_jam_penugasan,
    ADD CONSTRAINT fk_jam_penugasan_restrict
        FOREIGN KEY (id_penugasan) REFERENCES penugasan(id_penugasan)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE konfirmasi
    DROP FOREIGN KEY fk_konfirmasi_laporan,
    ADD CONSTRAINT fk_konfirmasi_laporan_restrict
        FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE pengajuan_suku_cadang
    DROP FOREIGN KEY fk_pengajuan_laporan,
    ADD CONSTRAINT fk_pengajuan_laporan_restrict
        FOREIGN KEY (id_laporan) REFERENCES laporan(id_laporan)
        ON DELETE RESTRICT ON UPDATE CASCADE;
