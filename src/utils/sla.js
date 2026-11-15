// Perhitungan target SLA (REQ-05, BR-05..07, BR-18).
//
// Asumsi (titik awal SLA belum dikonfirmasi klien — lihat SRS REQ-05):
//   - Titik awal = tanggal laporan dicatat (tanggalLapor).
//   - DARURAT : +4 jam kalender (berlaku juga malam/akhir pekan/libur, BR-18).
//   - TINGGI  : +1 hari (24 jam kalender).
//   - NORMAL  : +3 hari kerja (Senin–Jumat, akhir pekan dilewati).

const JAM = 60 * 60 * 1000;

function tambahHariKerja(dari, jumlah) {
  const d = new Date(dari);
  let sisa = jumlah;
  while (sisa > 0) {
    d.setDate(d.getDate() + 1);
    const hari = d.getDay();
    if (hari !== 0 && hari !== 6) sisa -= 1;
  }
  return d;
}

function hitungTargetSla(prioritas, mulai = new Date()) {
  const awal = new Date(mulai);
  switch (prioritas) {
    case 'DARURAT':
      return new Date(awal.getTime() + 4 * JAM);
    case 'TINGGI':
      return new Date(awal.getTime() + 24 * JAM);
    case 'NORMAL':
      return tambahHariKerja(awal, 3);
    default:
      return null;
  }
}

const LABEL_SLA = {
  DARURAT: '4 jam',
  TINGGI: '1 hari',
  NORMAL: '3 hari kerja',
};

// Laporan dianggap terlambat (REQ-15) bila target SLA terlewati sebelum teknisi
// menyatakan selesai. Bila sudah dinyatakan selesai, dibandingkan dengan waktu selesai teknisi.
function infoSla(laporan, sekarang = new Date()) {
  if (!laporan.targetSla) return { targetSla: null, terlambat: false, sisaMenit: null };
  const target = new Date(laporan.targetSla);
  const acuan = laporan.tglSelesaiTeknisi ? new Date(laporan.tglSelesaiTeknisi) : sekarang;
  const sisaMenit = Math.round((target.getTime() - acuan.getTime()) / 60000);
  return {
    targetSla: target,
    labelSla: LABEL_SLA[laporan.prioritas] || null,
    terlambat: sisaMenit < 0,
    sisaMenit,
  };
}

module.exports = { hitungTargetSla, tambahHariKerja, infoSla, LABEL_SLA };
