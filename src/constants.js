// Konstanta domain — diturunkan dari SRS (REQ, BR) dan ERD.

const ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  TEKNISI: 'TEKNISI',
  KEPALA_UNIT: 'KEPALA_UNIT',
  KEUANGAN: 'KEUANGAN',
  PELAPOR: 'PELAPOR',
});

// BR-01: listrik, AC, bangunan, air
const BIDANG = ['LISTRIK', 'AC', 'BANGUNAN', 'AIR'];

// REQ-03
const SUMBER_LAPORAN = ['WHATSAPP', 'TELEPON', 'DATANG_LANGSUNG'];

// REQ-04 / BR-04
const PRIORITAS = ['DARURAT', 'TINGGI', 'NORMAL'];

// Status laporan (siklus hidup)
const STATUS = Object.freeze({
  BARU: 'BARU', // dicatat, belum ditugaskan
  DITUGASKAN: 'DITUGASKAN', // sudah ada teknisi
  DIKERJAKAN: 'DIKERJAKAN', // teknisi sudah memulai / memperbarui progres
  DITAHAN: 'DITAHAN', // menunggu pengajuan suku cadang (REQ-20, BR-11)
  MENUNGGU_KONFIRMASI: 'MENUNGGU_KONFIRMASI', // teknisi menyatakan selesai (BR-12)
  DIBUKA_KEMBALI: 'DIBUKA_KEMBALI', // pelapor menyatakan belum selesai (BR-13)
  SELESAI: 'SELESAI', // dikonfirmasi pelapor
  SELESAI_OTOMATIS: 'SELESAI_OTOMATIS', // tanpa tanggapan 3 hari (BR-14)
});

const STATUS_FINAL = [STATUS.SELESAI, STATUS.SELESAI_OTOMATIS];

// Status yang boleh di-set teknisi melalui HP (REQ-09)
const STATUS_TEKNISI = [STATUS.DIKERJAKAN, STATUS.MENUNGGU_KONFIRMASI];

const JENIS_PERKEMBANGAN = [
  'PROGRES',
  'PEMERIKSAAN',
  'PERBAIKAN',
  'SELESAI_TEKNISI',
];

const HASIL_KONFIRMASI = ['SELESAI', 'BELUM_SELESAI', 'TIDAK_ADA_TANGGAPAN'];

// BR-11: ambang nilai suku cadang
const AMBANG_SUKU_CADANG = 500000;

module.exports = {
  ROLE,
  BIDANG,
  SUMBER_LAPORAN,
  PRIORITAS,
  STATUS,
  STATUS_FINAL,
  STATUS_TEKNISI,
  JENIS_PERKEMBANGAN,
  HASIL_KONFIRMASI,
  AMBANG_SUKU_CADANG,
};
