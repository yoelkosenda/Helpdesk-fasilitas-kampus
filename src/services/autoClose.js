// REQ-14 / BR-14: laporan dianggap selesai bila pelapor tidak memberikan
// tanggapan selama N hari (default 3) sejak teknisi menyatakan pekerjaan selesai.
const prisma = require('../db');
const config = require('../config');
const { STATUS } = require('../constants');
const { tambahHariKerja } = require('../utils/sla');

function batasWaktu(tglSelesaiTeknisi) {
  if (config.autoCloseMode === 'kerja') return tambahHariKerja(tglSelesaiTeknisi, config.autoCloseHari);
  return new Date(new Date(tglSelesaiTeknisi).getTime() + config.autoCloseHari * 24 * 60 * 60 * 1000);
}

async function jalankanAutoClose(sekarang = new Date()) {
  const kandidat = await prisma.laporan.findMany({
    where: { status: STATUS.MENUNGGU_KONFIRMASI, tglSelesaiTeknisi: { not: null } },
    select: { id: true, kode: true, tglSelesaiTeknisi: true },
  });
  const ditutup = [];
  for (const lap of kandidat) {
    if (batasWaktu(lap.tglSelesaiTeknisi) > sekarang) continue;
    await prisma.$transaction(async (tx) => {
      // Cek ulang agar tidak bentrok dengan konfirmasi yang masuk bersamaan
      const fresh = await tx.laporan.findUnique({ where: { id: lap.id }, select: { status: true } });
      if (fresh.status !== STATUS.MENUNGGU_KONFIRMASI) return;
      const catatan = `Tidak ada tanggapan pelapor selama ${config.autoCloseHari} hari ${config.autoCloseMode}; laporan dianggap selesai.`;
      await tx.konfirmasi.create({ data: { laporanId: lap.id, hasil: 'TIDAK_ADA_TANGGAPAN', catatan } });
      await tx.laporan.update({ where: { id: lap.id }, data: { status: STATUS.SELESAI_OTOMATIS, tglDitutup: sekarang } });
      await tx.penugasan.updateMany({ where: { laporanId: lap.id, statusTugas: 'AKTIF' }, data: { statusTugas: 'SELESAI' } });
      await tx.perkembangan.create({
        data: { laporanId: lap.id, status: STATUS.SELESAI_OTOMATIS, jenis: 'DITUTUP_OTOMATIS', catatan },
      });
      ditutup.push(lap.kode);
    });
  }
  return ditutup;
}

let timer = null;
function mulaiScheduler() {
  if (timer || !config.aktifkanScheduler) return;
  const run = () =>
    jalankanAutoClose()
      .then((list) => list.length && console.log(`[auto-close] ${list.length} laporan ditutup: ${list.join(', ')}`))
      .catch((e) => console.error('[auto-close] gagal:', e.message));
  run();
  timer = setInterval(run, config.autoCloseIntervalMenit * 60 * 1000);
  timer.unref();
}

module.exports = { jalankanAutoClose, mulaiScheduler, batasWaktu };
