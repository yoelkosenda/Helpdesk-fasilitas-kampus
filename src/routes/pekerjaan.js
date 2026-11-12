// Pekerjaan teknisi (REQ-08, UC-10), jam kerja (REQ-11, UC-07),
// dan tindak lanjut pengajuan suku cadang (REQ-20, UC-09).
const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, toInt, badRequest, forbidden, conflict, notFound } = require('../utils/http');
const { ROLE, STATUS, STATUS_FINAL } = require('../constants');
const { serialize, catatPerkembangan } = require('../services/laporanService');

const router = express.Router();
router.use(authenticate);
const { ADMIN, TEKNISI, KEPALA_UNIT, KEUANGAN } = ROLE;

// ---------- Daftar pekerjaan teknisi yang login ----------
router.get(
  '/pekerjaan-saya',
  authorize(TEKNISI),
  validate(z.object({ status: z.enum(['aktif', 'selesai', 'semua']).default('aktif') }), 'query'),
  asyncHandler(async (req, res) => {
    if (!req.user.teknisi) throw badRequest('Akun ini belum terhubung dengan data teknisi');
    const filter = req.valid.query.status;
    const where = { teknisiId: req.user.teknisi.id };
    if (filter === 'aktif') {
      where.statusTugas = 'AKTIF';
      where.laporan = { status: { notIn: STATUS_FINAL } };
    } else if (filter === 'selesai') {
      where.statusTugas = { not: 'AKTIF' };
    }
    const items = await prisma.penugasan.findMany({
      where,
      orderBy: { tglTugas: 'desc' },
      include: {
        jamKerja: true,
        laporan: {
          include: {
            ruang: { include: { gedung: true } },
            jenis: true,
            pelapor: true,
            penugasan: { include: { teknisi: true } },
          },
        },
      },
    });
    const data = items.map((p) => ({
      penugasanId: p.id,
      tglTugas: p.tglTugas,
      statusTugas: p.statusTugas,
      totalJamSaya: p.jamKerja.reduce((s, j) => s + j.durasiJam, 0),
      laporan: serialize(p.laporan, req),
    }));
    // Urutkan: Darurat > Tinggi > Normal, lalu target SLA terdekat
    const rank = { DARURAT: 0, TINGGI: 1, NORMAL: 2 };
    data.sort(
      (a, b) =>
        (rank[a.laporan.prioritas] ?? 3) - (rank[b.laporan.prioritas] ?? 3) ||
        new Date(a.laporan.targetSla || 8.64e15) - new Date(b.laporan.targetSla || 8.64e15),
    );
    ok(res, data, data.length ? 'Berhasil' : 'Belum ada pekerjaan yang ditugaskan');
  }),
);

// ---------- Jam kerja per teknisi per pekerjaan ----------
async function getPenugasan(id) {
  const p = await prisma.penugasan.findUnique({ where: { id }, include: { laporan: true, teknisi: true } });
  if (!p) throw notFound('Penugasan tidak ditemukan');
  return p;
}

function assertPemilik(user, p) {
  if (user.role === ADMIN) return;
  if (user.role === TEKNISI && user.teknisi && p.teknisiId === user.teknisi.id) return;
  throw forbidden('Jam kerja hanya dapat dicatat oleh teknisi yang bersangkutan');
}

router.get(
  '/penugasan/:id/jam-kerja',
  authorize(ADMIN, TEKNISI, KEPALA_UNIT),
  asyncHandler(async (req, res) => {
    const p = await getPenugasan(toInt(req.params.id));
    if (req.user.role === TEKNISI) assertPemilik(req.user, p);
    const list = await prisma.jamKerja.findMany({ where: { penugasanId: p.id }, orderBy: { tanggal: 'asc' } });
    ok(res, { penugasan: p, totalJam: list.reduce((s, j) => s + j.durasiJam, 0), jamKerja: list });
  }),
);

router.post(
  '/penugasan/:id/jam-kerja',
  authorize(ADMIN, TEKNISI),
  validate(
    z.object({
      durasiJam: z.coerce.number().positive('Durasi harus lebih dari 0').max(24, 'Durasi maksimal 24 jam per catatan'),
      tanggal: z.coerce.date().optional(),
      catatan: z.string().trim().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const p = await getPenugasan(toInt(req.params.id));
    assertPemilik(req.user, p);
    if (p.statusTugas === 'DIBATALKAN') throw conflict('Penugasan sudah dibatalkan');
    const tanggal = req.valid.body.tanggal || new Date();
    if (tanggal > new Date(Date.now() + 60 * 60 * 1000)) throw badRequest('Tanggal jam kerja tidak boleh di masa depan');
    const jam = await prisma.jamKerja.create({ data: { ...req.valid.body, tanggal, penugasanId: p.id } });
    ok(res, jam, 'Jam kerja berhasil dicatat', 201);
  }),
);

router.delete(
  '/jam-kerja/:id',
  authorize(ADMIN, TEKNISI),
  asyncHandler(async (req, res) => {
    const jam = await prisma.jamKerja.findUnique({ where: { id: toInt(req.params.id) }, include: { penugasan: true } });
    if (!jam) throw notFound('Catatan jam kerja tidak ditemukan');
    assertPemilik(req.user, jam.penugasan);
    await prisma.jamKerja.delete({ where: { id: jam.id } });
    ok(res, null, 'Catatan jam kerja dihapus');
  }),
);

// ---------- Pengajuan suku cadang ----------
router.get(
  '/pengajuan',
  authorize(ADMIN, KEUANGAN, KEPALA_UNIT),
  validate(z.object({ status: z.enum(['MENUNGGU', 'DITINDAKLANJUTI']).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const where = req.valid.query.status ? { status: req.valid.query.status } : {};
    const data = await prisma.pengajuanSukuCadang.findMany({
      where,
      orderBy: { tglPengajuan: 'desc' },
      include: {
        dicatatOleh: { select: { id: true, nama: true } },
        laporan: { include: { ruang: { include: { gedung: true } }, jenis: true } },
      },
    });
    ok(res, data);
  }),
);

router.patch(
  '/pengajuan/:id/tindak-lanjut',
  authorize(ADMIN, KEUANGAN),
  validate(z.object({ catatan: z.string().trim().min(1, 'Catatan tindak lanjut wajib diisi') })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const peng = await prisma.pengajuanSukuCadang.findUnique({ where: { id }, include: { laporan: true } });
    if (!peng) throw notFound('Pengajuan tidak ditemukan');
    if (peng.status !== 'MENUNGGU') throw conflict('Pengajuan sudah ditindaklanjuti');
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.pengajuanSukuCadang.update({
        where: { id },
        data: { status: 'DITINDAKLANJUTI', tglTindakLanjut: now, catatanTindakLanjut: req.valid.body.catatan },
      });
      const sisa = await tx.pengajuanSukuCadang.count({ where: { laporanId: peng.laporanId, status: 'MENUNGGU' } });
      const lap = peng.laporan;
      if (sisa === 0 && lap.status === STATUS.DITAHAN) {
        const kembali = lap.statusSebelumDitahan || STATUS.DIKERJAKAN;
        await tx.laporan.update({ where: { id: lap.id }, data: { status: kembali, statusSebelumDitahan: null } });
        await catatPerkembangan(tx, {
          laporanId: lap.id,
          status: kembali,
          jenis: 'DILANJUTKAN',
          catatan: `Pengajuan "${peng.namaBarang}" ditindaklanjuti: ${req.valid.body.catatan}. Pekerjaan dilanjutkan.`,
          userId: req.user.id,
        });
      } else {
        await catatPerkembangan(tx, {
          laporanId: lap.id,
          status: lap.status,
          jenis: 'DITAHAN',
          catatan: `Pengajuan "${peng.namaBarang}" ditindaklanjuti: ${req.valid.body.catatan}. Masih ada ${sisa} pengajuan menunggu.`,
          userId: req.user.id,
        });
      }
    });
    ok(res, await prisma.pengajuanSukuCadang.findUnique({ where: { id } }), 'Pengajuan ditandai sudah ditindaklanjuti');
  }),
);

module.exports = router;
