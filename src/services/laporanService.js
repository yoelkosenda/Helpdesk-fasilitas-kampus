const prisma = require('../db');
const { infoSla } = require('../utils/sla');
const { STATUS, STATUS_FINAL } = require('../constants');
const { notFound } = require('../utils/http');

const includeRingkas = {
  pelapor: true,
  ruang: { include: { gedung: true } },
  jenis: true,
  penugasan: { include: { teknisi: true }, orderBy: { tglTugas: 'asc' } },
  pengajuan: { where: { status: 'MENUNGGU' } },
};

const includeDetail = {
  pelapor: true,
  ruang: { include: { gedung: true } },
  jenis: true,
  dicatatOleh: { select: { id: true, nama: true, role: true } },
  penugasan: {
    include: { teknisi: true, jamKerja: { orderBy: { tanggal: 'asc' } } },
    orderBy: { tglTugas: 'asc' },
  },
  perkembangan: {
    include: { user: { select: { id: true, nama: true, role: true } } },
    orderBy: { waktu: 'asc' },
  },
  konfirmasi: {
    include: { dicatatOleh: { select: { id: true, nama: true, role: true } } },
    orderBy: { tanggal: 'asc' },
  },
  pengajuan: { orderBy: { tglPengajuan: 'asc' } },
};

// Menambahkan informasi turunan: SLA, keterlambatan, URL foto.
function serialize(laporan, req) {
  if (!laporan) return laporan;
  const sla = infoSla(laporan);
  const fotoUrl = laporan.foto && req ? `${req.protocol}://${req.get('host')}/uploads/${laporan.foto}` : null;
  const teknisiAktif = (laporan.penugasan || [])
    .filter((p) => p.statusTugas === 'AKTIF')
    .map((p) => ({ penugasanId: p.id, ...p.teknisi }));
  return {
    ...laporan,
    fotoUrl,
    sla,
    terlambat: sla.terlambat,
    selesai: STATUS_FINAL.includes(laporan.status),
    ditahan: laporan.status === STATUS.DITAHAN,
    teknisiAktif,
  };
}

async function getLaporanOrThrow(id, include = includeDetail) {
  const lap = await prisma.laporan.findUnique({ where: { id }, include });
  if (!lap) throw notFound('Laporan tidak ditemukan');
  return lap;
}

async function catatPerkembangan(tx, { laporanId, status, jenis, catatan, userId }) {
  return tx.perkembangan.create({ data: { laporanId, status, jenis, catatan, userId } });
}

async function generateKode(tx) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `LPR-${ym}-`;
  const last = await tx.laporan.findFirst({
    where: { kode: { startsWith: prefix } },
    orderBy: { kode: 'desc' },
    select: { kode: true },
  });
  const next = last ? Number(last.kode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

module.exports = { includeRingkas, includeDetail, serialize, getLaporanOrThrow, catatPerkembangan, generateKode };
