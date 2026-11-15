// Informasi manajemen untuk Kepala Unit (REQ-15..18, REQ-21; UC-08, UC-12, UC-13)
const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok } = require('../utils/http');
const { ROLE, STATUS, STATUS_FINAL } = require('../constants');
const { includeRingkas, serialize } = require('../services/laporanService');
const { jalankanAutoClose } = require('../services/autoClose');

const router = express.Router();
router.use(authenticate);
const { ADMIN, KEPALA_UNIT } = ROLE;
router.use(authorize(ADMIN, KEPALA_UNIT));

const bulanSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format bulan harus YYYY-MM')
  .optional();

function rentangBulan(bulan) {
  const now = new Date();
  const [y, m] = bulan ? bulan.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return { mulai: new Date(y, m - 1, 1), akhir: new Date(y, m, 1), label: `${y}-${String(m).padStart(2, '0')}` };
}

async function laporanAktif(req) {
  const list = await prisma.laporan.findMany({
    where: { status: { notIn: STATUS_FINAL } },
    include: includeRingkas,
    orderBy: { tanggalLapor: 'asc' },
  });
  return list.map((l) => serialize(l, req));
}

// Ringkasan / dashboard + peringatan keterlambatan (REQ-15 "langsung muncul")
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [aktif, perStatus, totalBulanIni] = await Promise.all([
      laporanAktif(req),
      prisma.laporan.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.laporan.count({ where: { tanggalLapor: { gte: rentangBulan().mulai } } }),
    ]);
    const terlambat = aktif.filter((l) => l.terlambat);
    const statusCount = Object.fromEntries(Object.values(STATUS).map((s) => [s, 0]));
    perStatus.forEach((r) => (statusCount[r.status] = r._count._all));
    ok(res, {
      ringkasan: {
        belumSelesai: aktif.length,
        terlambat: terlambat.length,
        ditahan: statusCount[STATUS.DITAHAN],
        menungguKonfirmasi: statusCount[STATUS.MENUNGGU_KONFIRMASI],
        belumDitugaskan: statusCount[STATUS.BARU] + statusCount[STATUS.DIBUKA_KEMBALI],
        tanpaPrioritas: aktif.filter((l) => !l.prioritas).length,
        laporanBulanIni: totalBulanIni,
      },
      perStatus: statusCount,
      peringatanTerlambat: terlambat.map((l) => ({
        id: l.id,
        kode: l.kode,
        prioritas: l.prioritas,
        gedung: l.ruang.gedung.namaGedung,
        ruang: l.ruang.namaRuang,
        jenis: l.jenis.namaJenis,
        status: l.status,
        targetSla: l.targetSla,
        terlambatMenit: -l.sla.sisaMenit,
      })),
    });
  }),
);

// REQ-16: daftar pekerjaan belum selesai
router.get(
  '/belum-selesai',
  asyncHandler(async (req, res) => {
    const data = await laporanAktif(req);
    ok(res, data, data.length ? 'Berhasil' : 'Tidak ada pekerjaan yang belum selesai');
  }),
);

// REQ-15/16: laporan terlambat / melewati batas waktu prioritas
router.get(
  '/terlambat',
  validate(z.object({ termasukSelesai: z.enum(['true', 'false']).default('false') }), 'query'),
  asyncHandler(async (req, res) => {
    let data;
    if (req.valid.query.termasukSelesai === 'true') {
      const all = await prisma.laporan.findMany({ where: { targetSla: { not: null } }, include: includeRingkas });
      data = all.map((l) => serialize(l, req)).filter((l) => l.terlambat);
    } else {
      data = (await laporanAktif(req)).filter((l) => l.terlambat);
    }
    data.sort((a, b) => a.sla.sisaMenit - b.sla.sisaMenit);
    ok(res, data, data.length ? 'Berhasil' : 'Tidak ada laporan yang terlambat');
  }),
);

// REQ-17: laporan bulanan per gedung dan jenis kerusakan
router.get(
  '/laporan-bulanan',
  validate(z.object({ bulan: bulanSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { mulai, akhir, label } = rentangBulan(req.valid.query.bulan);
    const list = await prisma.laporan.findMany({
      where: { tanggalLapor: { gte: mulai, lt: akhir } },
      include: includeRingkas,
      orderBy: { tanggalLapor: 'asc' },
    });
    if (!list.length) {
      return ok(res, { bulan: label, total: 0, perGedung: [], perJenis: [], matriks: [], rincian: [] }, 'Data tidak tersedia untuk periode ini');
    }
    const rows = list.map((l) => serialize(l, req));
    const group = (keyFn) => {
      const m = new Map();
      for (const l of rows) {
        const k = keyFn(l);
        const g = m.get(k) || { nama: k, total: 0, selesai: 0, belumSelesai: 0, terlambat: 0 };
        g.total += 1;
        if (l.selesai) g.selesai += 1;
        else g.belumSelesai += 1;
        if (l.terlambat) g.terlambat += 1;
        m.set(k, g);
      }
      return [...m.values()].sort((a, b) => b.total - a.total);
    };
    const matriks = new Map();
    for (const l of rows) {
      const k = `${l.ruang.gedung.namaGedung}||${l.jenis.namaJenis}`;
      matriks.set(k, (matriks.get(k) || 0) + 1);
    }
    ok(res, {
      bulan: label,
      total: rows.length,
      perGedung: group((l) => l.ruang.gedung.namaGedung),
      perJenis: group((l) => l.jenis.namaJenis),
      perPrioritas: group((l) => l.prioritas || 'BELUM_DITETAPKAN'),
      matriks: [...matriks.entries()].map(([k, jumlah]) => {
        const [gedung, jenis] = k.split('||');
        return { gedung, jenis, jumlah };
      }),
      rincian: rows.map((l) => ({
        id: l.id,
        kode: l.kode,
        tanggalLapor: l.tanggalLapor,
        gedung: l.ruang.gedung.namaGedung,
        ruang: l.ruang.namaRuang,
        jenis: l.jenis.namaJenis,
        prioritas: l.prioritas,
        status: l.status,
        terlambat: l.terlambat,
      })),
    });
  }),
);

// REQ-18: rekap jam kerja per teknisi per pekerjaan
router.get(
  '/rekap-jam-kerja',
  validate(
    z.object({
      bulan: bulanSchema,
      teknisiId: z.coerce.number().int().positive().optional(),
      laporanId: z.coerce.number().int().positive().optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const q = req.valid.query;
    const where = { penugasan: {} };
    if (q.bulan) {
      const { mulai, akhir } = rentangBulan(q.bulan);
      where.tanggal = { gte: mulai, lt: akhir };
    }
    if (q.teknisiId) where.penugasan.teknisiId = q.teknisiId;
    if (q.laporanId) where.penugasan.laporanId = q.laporanId;
    const list = await prisma.jamKerja.findMany({
      where,
      include: {
        penugasan: {
          include: { teknisi: true, laporan: { include: { ruang: { include: { gedung: true } }, jenis: true } } },
        },
      },
      orderBy: { tanggal: 'asc' },
    });
    if (!list.length) {
      return ok(res, { periode: q.bulan || 'semua', perTeknisi: [], perPekerjaan: [] }, 'Data jam kerja belum tersedia');
    }
    const perPekerjaan = new Map();
    const perTeknisi = new Map();
    for (const j of list) {
      const { teknisi, laporan } = j.penugasan;
      const key = `${teknisi.id}-${laporan.id}`;
      const row = perPekerjaan.get(key) || {
        teknisiId: teknisi.id,
        namaTeknisi: teknisi.nama,
        bidang: teknisi.bidang,
        laporanId: laporan.id,
        kodeLaporan: laporan.kode,
        gedung: laporan.ruang.gedung.namaGedung,
        ruang: laporan.ruang.namaRuang,
        jenis: laporan.jenis.namaJenis,
        totalJam: 0,
        jumlahCatatan: 0,
      };
      row.totalJam += j.durasiJam;
      row.jumlahCatatan += 1;
      perPekerjaan.set(key, row);

      const t = perTeknisi.get(teknisi.id) || { teknisiId: teknisi.id, namaTeknisi: teknisi.nama, bidang: teknisi.bidang, totalJam: 0, pekerjaan: new Set() };
      t.totalJam += j.durasiJam;
      t.pekerjaan.add(laporan.id);
      perTeknisi.set(teknisi.id, t);
    }
    ok(res, {
      periode: q.bulan || 'semua',
      perTeknisi: [...perTeknisi.values()]
        .map(({ pekerjaan, ...t }) => ({ ...t, totalJam: +t.totalJam.toFixed(2), jumlahPekerjaan: pekerjaan.size }))
        .sort((a, b) => b.totalJam - a.totalJam),
      perPekerjaan: [...perPekerjaan.values()].map((r) => ({ ...r, totalJam: +r.totalJam.toFixed(2) })),
    });
  }),
);

// Menjalankan penutupan otomatis secara manual (REQ-14)
router.post(
  '/auto-close/jalankan',
  authorize(ADMIN),
  asyncHandler(async (req, res) => {
    const ditutup = await jalankanAutoClose();
    ok(res, { ditutup }, `${ditutup.length} laporan ditutup otomatis`);
  }),
);

module.exports = router;
