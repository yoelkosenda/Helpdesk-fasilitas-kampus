// Data master: gedung, ruang, jenis kerusakan, teknisi, pelapor, pengguna.
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, toInt, badRequest } = require('../utils/http');
const { ROLE, BIDANG } = require('../constants');

const router = express.Router();
router.use(authenticate);

const INTERNAL = [ROLE.ADMIN, ROLE.TEKNISI, ROLE.KEPALA_UNIT, ROLE.KEUANGAN];
const adminOnly = authorize(ROLE.ADMIN);

// ---------- Gedung ----------
router.get(
  '/gedung',
  authorize(...INTERNAL),
  asyncHandler(async (req, res) => {
    const data = await prisma.gedung.findMany({
      orderBy: { namaGedung: 'asc' },
      include: { ruang: { orderBy: { namaRuang: 'asc' } } },
    });
    ok(res, data);
  }),
);

router.post(
  '/gedung',
  adminOnly,
  validate(z.object({ namaGedung: z.string().trim().min(1) })),
  asyncHandler(async (req, res) => ok(res, await prisma.gedung.create({ data: req.valid.body }), 'Gedung ditambahkan', 201)),
);

router.put(
  '/gedung/:id',
  adminOnly,
  validate(z.object({ namaGedung: z.string().trim().min(1) })),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.gedung.update({ where: { id: toInt(req.params.id) }, data: req.valid.body }), 'Gedung diperbarui'),
  ),
);

router.delete(
  '/gedung/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.gedung.delete({ where: { id: toInt(req.params.id) } });
    ok(res, null, 'Gedung dihapus');
  }),
);

// ---------- Ruang ----------
router.get(
  '/ruang',
  authorize(...INTERNAL),
  asyncHandler(async (req, res) => {
    const where = req.query.gedungId ? { gedungId: toInt(req.query.gedungId, 'gedungId') } : {};
    ok(res, await prisma.ruang.findMany({ where, include: { gedung: true }, orderBy: [{ gedungId: 'asc' }, { namaRuang: 'asc' }] }));
  }),
);

const ruangSchema = z.object({ namaRuang: z.string().trim().min(1), gedungId: z.coerce.number().int().positive() });
router.post(
  '/ruang',
  adminOnly,
  validate(ruangSchema),
  asyncHandler(async (req, res) => ok(res, await prisma.ruang.create({ data: req.valid.body }), 'Ruang ditambahkan', 201)),
);
router.put(
  '/ruang/:id',
  adminOnly,
  validate(ruangSchema.partial()),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.ruang.update({ where: { id: toInt(req.params.id) }, data: req.valid.body }), 'Ruang diperbarui'),
  ),
);
router.delete(
  '/ruang/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.ruang.delete({ where: { id: toInt(req.params.id) } });
    ok(res, null, 'Ruang dihapus');
  }),
);

// ---------- Jenis kerusakan ----------
router.get(
  '/jenis-kerusakan',
  authorize(...INTERNAL),
  asyncHandler(async (req, res) => ok(res, await prisma.jenisKerusakan.findMany({ orderBy: { namaJenis: 'asc' } }))),
);
const jenisSchema = z.object({ namaJenis: z.string().trim().min(1), bidang: z.enum(BIDANG) });
router.post(
  '/jenis-kerusakan',
  adminOnly,
  validate(jenisSchema),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.jenisKerusakan.create({ data: req.valid.body }), 'Jenis kerusakan ditambahkan', 201),
  ),
);
router.put(
  '/jenis-kerusakan/:id',
  adminOnly,
  validate(jenisSchema.partial()),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.jenisKerusakan.update({ where: { id: toInt(req.params.id) }, data: req.valid.body }),
      'Jenis kerusakan diperbarui',
    ),
  ),
);

// ---------- Teknisi ----------
router.get(
  '/teknisi',
  authorize(ROLE.ADMIN, ROLE.KEPALA_UNIT),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.bidang) where.bidang = String(req.query.bidang).toUpperCase();
    if (req.query.aktif !== undefined) where.aktif = req.query.aktif === 'true';
    const data = await prisma.teknisi.findMany({
      where,
      orderBy: { nama: 'asc' },
      include: {
        _count: { select: { penugasan: { where: { statusTugas: 'AKTIF' } } } },
      },
    });
    // Jumlah pekerjaan aktif membantu Admin menilai teknisi yang sedang sibuk (US-04)
    ok(res, data.map(({ _count, ...t }) => ({ ...t, pekerjaanAktif: _count.penugasan })));
  }),
);

const teknisiSchema = z.object({
  nama: z.string().trim().min(1),
  bidang: z.enum(BIDANG),
  aktif: z.boolean().optional(),
  username: z.string().trim().min(3).optional(),
  password: z.string().min(6).optional(),
});
router.post(
  '/teknisi',
  adminOnly,
  validate(teknisiSchema),
  asyncHandler(async (req, res) => {
    const { username, password, ...data } = req.valid.body;
    if ((username && !password) || (!username && password)) throw badRequest('username dan password harus diisi bersamaan');
    const created = await prisma.$transaction(async (tx) => {
      let userId;
      if (username) {
        const u = await tx.user.create({
          data: { username, password: await bcrypt.hash(password, 10), nama: data.nama, role: ROLE.TEKNISI },
        });
        userId = u.id;
      }
      return tx.teknisi.create({ data: { ...data, userId } });
    });
    ok(res, created, 'Teknisi ditambahkan', 201);
  }),
);
router.put(
  '/teknisi/:id',
  adminOnly,
  validate(teknisiSchema.omit({ username: true, password: true }).partial()),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.teknisi.update({ where: { id: toInt(req.params.id) }, data: req.valid.body }), 'Teknisi diperbarui'),
  ),
);

// ---------- Pelapor ----------
router.get(
  '/pelapor',
  adminOnly,
  asyncHandler(async (req, res) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const where = q ? { OR: [{ nama: { contains: q } }, { kontak: { contains: q } }] } : {};
    ok(res, await prisma.pelapor.findMany({ where, orderBy: { nama: 'asc' }, take: 100 }));
  }),
);
const pelaporSchema = z.object({ nama: z.string().trim().min(1), kontak: z.string().trim().optional() });
router.post(
  '/pelapor',
  adminOnly,
  validate(pelaporSchema),
  asyncHandler(async (req, res) => ok(res, await prisma.pelapor.create({ data: req.valid.body }), 'Pelapor ditambahkan', 201)),
);
router.put(
  '/pelapor/:id',
  adminOnly,
  validate(pelaporSchema.partial()),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.pelapor.update({ where: { id: toInt(req.params.id) }, data: req.valid.body }), 'Pelapor diperbarui'),
  ),
);

// ---------- Pengguna (akun) ----------
router.get(
  '/users',
  adminOnly,
  asyncHandler(async (req, res) => {
    const data = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, username: true, nama: true, role: true, aktif: true, teknisi: true, pelapor: true },
    });
    ok(res, data);
  }),
);
router.post(
  '/users',
  adminOnly,
  validate(
    z.object({
      username: z.string().trim().min(3),
      password: z.string().min(6),
      nama: z.string().trim().min(1),
      role: z.enum([ROLE.ADMIN, ROLE.KEPALA_UNIT, ROLE.KEUANGAN, ROLE.PELAPOR]),
      kontak: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { password, kontak, ...data } = req.valid.body;
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { ...data, password: await bcrypt.hash(password, 10) } });
      if (u.role === ROLE.PELAPOR) await tx.pelapor.create({ data: { nama: u.nama, kontak, userId: u.id } });
      return u;
    });
    const { password: _pw, ...safe } = user;
    ok(res, safe, 'Pengguna ditambahkan', 201);
  }),
);
router.patch(
  '/users/:id/aktif',
  adminOnly,
  validate(z.object({ aktif: z.boolean() })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    if (id === req.user.id) throw badRequest('Tidak dapat menonaktifkan akun sendiri');
    const u = await prisma.user.update({ where: { id }, data: { aktif: req.valid.body.aktif }, select: { id: true, aktif: true } });
    ok(res, u, 'Status akun diperbarui');
  }),
);

module.exports = router;
