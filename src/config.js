require('dotenv').config();

const bool = (v, def) => (v === undefined ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'ganti-secret-ini-di-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  // BR-03: foto termasuk informasi minimum. Pengecualian belum dikonfirmasi klien,
  // sehingga dibuat dapat dikonfigurasi.
  wajibFoto: bool(process.env.WAJIB_FOTO, true),
  // BR-14: jumlah hari tanpa tanggapan sebelum laporan dianggap selesai.
  autoCloseHari: Number(process.env.AUTO_CLOSE_HARI || 3),
  // Hitungan hari auto-close: "kalender" atau "kerja" (belum dikonfirmasi klien).
  autoCloseMode: process.env.AUTO_CLOSE_MODE === 'kerja' ? 'kerja' : 'kalender',
  autoCloseIntervalMenit: Number(process.env.AUTO_CLOSE_INTERVAL_MENIT || 60),
  aktifkanScheduler: bool(process.env.AKTIFKAN_SCHEDULER, true),
};
