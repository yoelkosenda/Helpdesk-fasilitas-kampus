// Laporan kerusakan: pencatatan, prioritas/SLA, penugasan, perkembangan,
// penyelesaian teknisi, konfirmasi pelapor, buka kembali, pengajuan suku cadang.
const fs = require('fs');
const path = require('path');
const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, toInt, badRequest, forbidden, conflict } = require('../utils/http');
const { hitungTargetSla } = require('../utils/sla');
const { batasWaktu } = require('../services/autoClose');
const {
  ROLE,
  SUMBER_LAPORAN,
  PRIORITAS,
  STATUS,
  STATUS_FINAL,
  JENIS_PERKEMBANGAN,
  AMBANG_SUKU_CADANG,
} = require('../constants');
const { includeRingkas, includeDetail, serialize, getLaporanOrThrow, catatPerkembangan, generateKode } = require(
  '../services/laporanService',
);

const router = express.Router();
router.use(authenticate);

const { ADMIN, TEKNISI, KEPALA_UNIT, KEUANGAN, PELAPOR } = ROLE;

// ---------- Helper akses ----------

function whereByRole(user) {
  switch (user.role) {
    case ADMIN:
    case KEPALA_UNIT:
      return {};
    case TEKNISI:
      return { penugasan: { some: { teknisiId: user.teknisi ? user.teknisi.id : -1 } } };
    case KEUANGAN:
      return { pengajuan: { some: {} } };
    case PELAPOR:
      return { pelaporId: user.pelapor ? user.pelapor.id : -1 };
    default:
      return { id: -1 };
  }
}

function assertBisaAkses(user, lap) {
  if ([ADMIN, KEPALA_UNIT].includes(user.role)) return;
  if (user.role === TEKNISI && user.teknisi && lap.penugasan.some((p) => p.teknisiId === user.teknisi.id)) return;
  if (user.role === PELAPOR && user.pelapor && lap.pelaporId === user.pelapor.id) return;
  if (user.role === KEUANGAN && lap.pengajuan.length > 0) return;
  throw forbidden('Anda tidak memiliki akses ke laporan ini');
}

function assertTeknisiDitugaskan(user, lap) {
  if (user.role === ADMIN) return;
  const aktif = lap.penugasan.some((p) => p.teknisiId === user.teknisi?.id && p.statusTugas === 'AKTIF');
  if (!aktif) throw forbidden('Anda tidak ditugaskan secara aktif pada laporan ini');
}

function assertBelumFinal(lap) {
  if (STATUS_FINAL.includes(lap.status)) throw conflict('Laporan sudah selesai/ditutup');
}

function hapusFoto(nama) {
  if (!nama) return;
  fs.promises.unlink(path.resolve(config.uploadDir, nama)).catch(() => {});
}

// ---------- Daftar & detail ----------

const listQuery = z.object({
  status: z.string().optional(), // boleh dipisah koma
  prioritas: z.enum(PRIORITAS).optional(),
  gedungId: z.coerce.number().int().positive().optional(),
  ruangId: z.coerce.number().int().positive().optional(),
  jenisId: z.coerce.number().int().positive().optional(),
  teknisiId: z.coerce.number().int().positive().optional(),
  sumberLaporan: z.enum(SUMBER_LAPORAN).optional(),
  belumSelesai: z.enum(['true', 'false']).optional(),
  terlambat: z.enum(['true', 'false']).optional(),
  dari: z.coerce.date().optional(),
  sampai: z.coerce.date().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const f = req.valid.query;
    const and = [whereByRole(req.user)];
    if (f.status) and.push({ status: { in: f.status.split(',').map((s) => s.trim().toUpperCase()) } });
    if (f.prioritas) and.push({ prioritas: f.prioritas });
    if (f.ruangId) and.push({ ruangId: f.ruangId });
    if (f.gedungId) and.push({ ruang: { gedungId: f.gedungId } });
    if (f.jenisId) and.push({ jenisId: f.jenisId });
    if (f.sumberLaporan) and.push({ sumberLaporan: f.sumberLaporan });
    if (f.teknisiId) and.push({ penugasan: { some: { teknisiId: f.teknisiId } } });
    if (f.belumSelesai === 'true') and.push({ status: { notIn: STATUS_FINAL } });
    if (f.belumSelesai === 'false') and.push({ status: { in: STATUS_FINAL } });
    if (f.dari) and.push({ tanggalLapor: { gte: f.dari } });
    if (f.sampai) and.push({ tanggalLapor: { lte: f.sampai } });
    if (f.q) and.push({ OR: [{ kode: { contains: f.q } }, { deskripsi: { contains: f.q } }, { pelapor: { nama: { contains: f.q } } }] });
    const where = { AND: and };

    let items;
    let total;
    if (f.terlambat) {
      // Status terlambat dihitung dari SLA, sehingga difilter setelah query.
      const all = (await prisma.laporan.findMany({ where, include: includeRingkas, orderBy: { tanggalLapor: 'desc' } })).map(
        (l) => serialize(l, req),
      );
      const filtered = all.filter((l) => l.terlambat === (f.terlambat === 'true'));
      total = filtered.length;
      items = filtered.slice((f.page - 1) * f.limit, f.page * f.limit);
    } else {
      [total, items] = await Promise.all([
        prisma.laporan.count({ where }),
        prisma.laporan.findMany({
          where,
          include: includeRingkas,
          orderBy: { tanggalLapor: 'desc' },
          skip: (f.page - 1) * f.limit,
          take: f.limit,
        }),
      ]);
      items = items.map((l) => serialize(l, req));
    }
    res.json({ success: true, data: items, meta: { total, page: f.page, limit: f.limit, totalPage: Math.ceil(total / f.limit) } });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lap = await getLaporanOrThrow(toInt(req.params.id));
    assertBisaAkses(req.user, lap);
    ok(res, serialize(lap, req));
  }),
);

// ---------- Pencatatan laporan (REQ-01, REQ-02, REQ-03; UC-03) ----------

const createSchema = z
  .object({
    sumberLaporan: z.enum(SUMBER_LAPORAN),
    ruangId: z.coerce.number().int().positive(),
    jenisId: z.coerce.number().int().positive(),
    deskripsi: z.string().trim().max(2000).optional(),
    prioritas: z.enum(PRIORITAS).optional(),
    tanggalLapor: z.coerce.date().optional(),
    pelaporId: z.coerce.number().int().positive().optional(),
    pelaporNama: z.string().trim().min(1).optional(),
    pelaporKontak: z.string().trim().optional(),
  })
  .refine((d) => d.pelaporId || d.pelaporNama, { message: 'pelaporId atau pelaporNama wajib diisi', path: ['pelaporId'] });

router.post(
  '/',
  authorize(ADMIN),
  upload.single('foto'),
  (req, res, next) => validate(createSchema)(req, res, (err) => {
    if (err && req.file) hapusFoto(req.file.filename);
    next(err);
  }),
  asyncHandler(async (req, res) => {
    const b = req.valid.body;
    try {
      if (config.wajibFoto && !req.file) throw badRequest('Foto kerusakan wajib dilampirkan (BR-03)');
      const [ruang, jenis] = await Promise.all([
        prisma.ruang.findUnique({ where: { id: b.ruangId } }),
        prisma.jenisKerusakan.findUnique({ where: { id: b.jenisId } }),
      ]);
      if (!ruang) throw badRequest('Ruang tidak ditemukan');
      if (!jenis) throw badRequest('Jenis kerusakan tidak ditemukan');

      const lap = await prisma.$transaction(async (tx) => {
        let pelaporId = b.pelaporId;
        if (pelaporId) {
          const p = await tx.pelapor.findUnique({ where: { id: pelaporId } });
          if (!p) throw badRequest('Pelapor tidak ditemukan');
        } else {
          const p = await tx.pelapor.create({ data: { nama: b.pelaporNama, kontak: b.pelaporKontak } });
          pelaporId = p.id;
        }
        const tanggalLapor = b.tanggalLapor || new Date();
        const created = await tx.laporan.create({
          data: {
            kode: await generateKode(tx),
            tanggalLapor,
            sumberLaporan: b.sumberLaporan,
            prioritas: b.prioritas,
            targetSla: b.prioritas ? hitungTargetSla(b.prioritas, tanggalLapor) : null,
            deskripsi: b.deskripsi,
            foto: req.file ? req.file.filename : null,
            pelaporId,
            ruangId: b.ruangId,
            jenisId: b.jenisId,
            dicatatOlehId: req.user.id,
            status: STATUS.BARU,
          },
        });
        await catatPerkembangan(tx, {
          laporanId: created.id,
          status: STATUS.BARU,
          jenis: 'PENCATATAN',
          catatan: `Laporan dicatat dari sumber ${b.sumberLaporan}${b.prioritas ? `, prioritas ${b.prioritas}` : ''}`,
          userId: req.user.id,
        });
        return created;
      });
      ok(res, serialize(await getLaporanOrThrow(lap.id), req), 'Laporan berhasil disimpan', 201);
    } catch (err) {
      if (req.file) hapusFoto(req.file.filename);
      throw err;
    }
  }),
);

const updateSchema = z.object({
  sumberLaporan: z.enum(SUMBER_LAPORAN).optional(),
  ruangId: z.coerce.number().int().positive().optional(),
  jenisId: z.coerce.number().int().positive().optional(),
  deskripsi: z.string().trim().max(2000).optional(),
});

router.put(
  '/:id',
  authorize(ADMIN),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    await prisma.laporan.update({ where: { id }, data: req.valid.body });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Laporan diperbarui');
  }),
);

router.put(
  '/:id/foto',
  authorize(ADMIN),
  upload.single('foto'),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    if (!req.file) throw badRequest('File foto wajib dikirim pada field "foto"');
    const lap = await prisma.laporan.findUnique({ where: { id } });
    if (!lap) {
      hapusFoto(req.file.filename);
      throw badRequest('Laporan tidak ditemukan');
    }
    await prisma.laporan.update({ where: { id }, data: { foto: req.file.filename } });
    hapusFoto(lap.foto);
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Foto diperbarui');
  }),
);

// ---------- Prioritas & SLA (REQ-04, REQ-05) ----------

router.patch(
  '/:id/prioritas',
  authorize(ADMIN),
  validate(z.object({ prioritas: z.enum(PRIORITAS), catatan: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    const { prioritas, catatan } = req.valid.body;
    const targetSla = hitungTargetSla(prioritas, lap.tanggalLapor);
    await prisma.$transaction(async (tx) => {
      await tx.laporan.update({ where: { id }, data: { prioritas, targetSla } });
      await catatPerkembangan(tx, {
        laporanId: id,
        status: lap.status,
        jenis: 'PRIORITAS',
        catatan: `Prioritas ditetapkan ${prioritas}${lap.prioritas && lap.prioritas !== prioritas ? ` (sebelumnya ${lap.prioritas})` : ''}${catatan ? ` — ${catatan}` : ''}`,
        userId: req.user.id,
      });
    });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Prioritas dan target SLA disimpan');
  }),
);

// ---------- Penugasan teknisi (REQ-06, REQ-07, BR-09) ----------

router.post(
  '/:id/penugasan',
  authorize(ADMIN),
  validate(z.object({ teknisiIds: z.array(z.coerce.number().int().positive()).min(1), catatan: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    if (lap.status === STATUS.MENUNGGU_KONFIRMASI) throw conflict('Laporan sedang menunggu konfirmasi pelapor');
    const ids = [...new Set(req.valid.body.teknisiIds)];
    const teknisi = await prisma.teknisi.findMany({ where: { id: { in: ids } } });
    if (teknisi.length !== ids.length) throw badRequest('Sebagian teknisi tidak ditemukan');
    const nonaktif = teknisi.filter((t) => !t.aktif);
    if (nonaktif.length) throw badRequest(`Teknisi tidak aktif: ${nonaktif.map((t) => t.nama).join(', ')}`);

    const sudahAktif = new Set(lap.penugasan.filter((p) => p.statusTugas === 'AKTIF').map((p) => p.teknisiId));
    const baru = teknisi.filter((t) => !sudahAktif.has(t.id));
    if (!baru.length) throw conflict('Semua teknisi tersebut sudah ditugaskan pada laporan ini');

    // Peringatan bila bidang teknisi berbeda dengan bidang jenis kerusakan
    // (tetap diizinkan untuk pekerjaan besar lintas bidang, BR-09).
    const peringatan = baru
      .filter((t) => t.bidang !== lap.jenis.bidang)
      .map((t) => `${t.nama} (bidang ${t.bidang}) berbeda dengan bidang kerusakan ${lap.jenis.bidang}`);

    const statusBaru = [STATUS.BARU, STATUS.DIBUKA_KEMBALI].includes(lap.status) ? STATUS.DITUGASKAN : lap.status;
    await prisma.$transaction(async (tx) => {
      for (const t of baru) await tx.penugasan.create({ data: { laporanId: id, teknisiId: t.id } });
      await tx.laporan.update({ where: { id }, data: { status: statusBaru } });
      await catatPerkembangan(tx, {
        laporanId: id,
        status: statusBaru,
        jenis: 'PENUGASAN',
        catatan: `Ditugaskan kepada: ${baru.map((t) => t.nama).join(', ')}${req.valid.body.catatan ? ` — ${req.valid.body.catatan}` : ''}`,
        userId: req.user.id,
      });
    });
    const data = serialize(await getLaporanOrThrow(id), req);
    ok(res, { ...data, peringatan }, 'Teknisi berhasil ditugaskan', 201);
  }),
);

// Mengalihkan / membatalkan penugasan seorang teknisi (US-04 alur alternatif)
router.delete(
  '/:id/penugasan/:penugasanId',
  authorize(ADMIN),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const pid = toInt(req.params.penugasanId, 'penugasanId');
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    const p = lap.penugasan.find((x) => x.id === pid);
    if (!p) throw badRequest('Penugasan tidak ditemukan pada laporan ini');
    if (p.statusTugas !== 'AKTIF') throw conflict('Penugasan sudah tidak aktif');
    const sisaAktif = lap.penugasan.filter((x) => x.statusTugas === 'AKTIF' && x.id !== pid).length;
    const statusBaru =
      sisaAktif === 0 && [STATUS.DITUGASKAN, STATUS.DIKERJAKAN].includes(lap.status) ? STATUS.BARU : lap.status;
    await prisma.$transaction(async (tx) => {
      await tx.penugasan.update({ where: { id: pid }, data: { statusTugas: 'DIBATALKAN' } });
      await tx.laporan.update({ where: { id }, data: { status: statusBaru } });
      await catatPerkembangan(tx, {
        laporanId: id,
        status: statusBaru,
        jenis: 'PENUGASAN',
        catatan: `Penugasan ${p.teknisi.nama} dibatalkan/dialihkan`,
        userId: req.user.id,
      });
    });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Penugasan dibatalkan');
  }),
);

// ---------- Perkembangan & status oleh teknisi (REQ-09, REQ-10) ----------

router.post(
  '/:id/perkembangan',
  authorize(ADMIN, TEKNISI),
  validate(z.object({ jenis: z.enum(['PROGRES', 'PEMERIKSAAN', 'PERBAIKAN']).default('PROGRES'), catatan: z.string().trim().min(1) })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    assertTeknisiDitugaskan(req.user, lap);
    if (lap.status === STATUS.MENUNGGU_KONFIRMASI) throw conflict('Pekerjaan sudah dinyatakan selesai dan menunggu konfirmasi');
    const statusBaru = [STATUS.DITUGASKAN, STATUS.DIBUKA_KEMBALI].includes(lap.status) ? STATUS.DIKERJAKAN : lap.status;
    await prisma.$transaction(async (tx) => {
      if (statusBaru !== lap.status) await tx.laporan.update({ where: { id }, data: { status: statusBaru } });
      await catatPerkembangan(tx, { laporanId: id, status: statusBaru, jenis: req.valid.body.jenis, catatan: req.valid.body.catatan, userId: req.user.id });
    });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Perkembangan berhasil disimpan', 201);
  }),
);

// Teknisi melaporkan hasil pemeriksaan/perbaikan & menyatakan selesai (UC-06, BR-12)
async function selesaiTeknisi(req, id, catatan) {
  const lap = await getLaporanOrThrow(id, includeRingkas);
  assertBelumFinal(lap);
  assertTeknisiDitugaskan(req.user, lap);
  if (lap.status === STATUS.DITAHAN) throw conflict('Pekerjaan sedang ditahan menunggu pengajuan suku cadang');
  if (lap.status === STATUS.MENUNGGU_KONFIRMASI) throw conflict('Pekerjaan sudah dinyatakan selesai');
  if (lap.status === STATUS.BARU) throw conflict('Laporan belum ditugaskan kepada teknisi');
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.laporan.update({ where: { id }, data: { status: STATUS.MENUNGGU_KONFIRMASI, tglSelesaiTeknisi: now } });
    await catatPerkembangan(tx, { laporanId: id, status: STATUS.MENUNGGU_KONFIRMASI, jenis: 'SELESAI_TEKNISI', catatan, userId: req.user.id });
  });
}

router.post(
  '/:id/selesai-teknisi',
  authorize(ADMIN, TEKNISI),
  validate(z.object({ catatan: z.string().trim().min(1, 'Hasil pemeriksaan/perbaikan wajib diisi') })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    await selesaiTeknisi(req, id, req.valid.body.catatan);
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Pekerjaan dinyatakan selesai, menunggu konfirmasi pelapor');
  }),
);

// Endpoint generik pembaruan status dari HP teknisi (REQ-09)
router.patch(
  '/:id/status',
  authorize(ADMIN, TEKNISI),
  validate(z.object({ status: z.enum([STATUS.DIKERJAKAN, STATUS.MENUNGGU_KONFIRMASI]), catatan: z.string().trim().min(1) })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const { status, catatan } = req.valid.body;
    if (status === STATUS.MENUNGGU_KONFIRMASI) {
      await selesaiTeknisi(req, id, catatan);
    } else {
      const lap = await getLaporanOrThrow(id, includeRingkas);
      assertBelumFinal(lap);
      assertTeknisiDitugaskan(req.user, lap);
      if (![STATUS.DITUGASKAN, STATUS.DIBUKA_KEMBALI, STATUS.DIKERJAKAN].includes(lap.status)) {
        throw conflict(`Status tidak dapat diubah dari ${lap.status} menjadi ${status}`);
      }
      await prisma.$transaction(async (tx) => {
        await tx.laporan.update({ where: { id }, data: { status } });
        await catatPerkembangan(tx, { laporanId: id, status, jenis: 'PROGRES', catatan, userId: req.user.id });
      });
    }
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Status berhasil diperbarui');
  }),
);

// ---------- Konfirmasi pelapor & buka kembali (REQ-12, REQ-13, REQ-14) ----------

const konfirmasiSchema = z.object({
  hasil: z.enum(['SELESAI', 'BELUM_SELESAI', 'TIDAK_ADA_TANGGAPAN']),
  catatan: z.string().trim().optional(),
  // Opsional: langsung menugaskan ulang teknisi saat dibuka kembali (US-11)
  teknisiIds: z.array(z.coerce.number().int().positive()).optional(),
});

async function prosesKonfirmasi(req, id, { hasil, catatan, teknisiIds }) {
  const lap = await getLaporanOrThrow(id, includeRingkas);
  assertBelumFinal(lap);
  if (req.user.role === PELAPOR) {
    if (!req.user.pelapor || lap.pelaporId !== req.user.pelapor.id) throw forbidden('Bukan laporan Anda');
    if (hasil === 'TIDAK_ADA_TANGGAPAN') throw forbidden();
    if (teknisiIds?.length) throw forbidden('Pelapor tidak dapat menugaskan teknisi');
  }
  if (lap.status !== STATUS.MENUNGGU_KONFIRMASI) {
    throw conflict('Konfirmasi hanya dapat dicatat setelah teknisi menyatakan pekerjaan selesai');
  }
  const now = new Date();
  if (hasil === 'TIDAK_ADA_TANGGAPAN' && batasWaktu(lap.tglSelesaiTeknisi) > now) {
    throw conflict(`Belum ${config.autoCloseHari} hari sejak teknisi menyatakan selesai`);
  }

  let teknisiBaru = [];
  if (hasil === 'BELUM_SELESAI' && teknisiIds?.length) {
    teknisiBaru = await prisma.teknisi.findMany({ where: { id: { in: [...new Set(teknisiIds)] }, aktif: true } });
    if (teknisiBaru.length !== new Set(teknisiIds).size) throw badRequest('Sebagian teknisi tidak ditemukan/tidak aktif');
  }

  await prisma.$transaction(async (tx) => {
    await tx.konfirmasi.create({ data: { laporanId: id, hasil, catatan, dicatatOlehId: req.user.id } });
    if (hasil === 'BELUM_SELESAI') {
      // BR-13: laporan dibuka kembali; penugasan lama ditutup, teknisi ditugaskan ulang
      await tx.penugasan.updateMany({ where: { laporanId: id, statusTugas: 'AKTIF' }, data: { statusTugas: 'SELESAI' } });
      let status = STATUS.DIBUKA_KEMBALI;
      await tx.laporan.update({ where: { id }, data: { status, tglSelesaiTeknisi: null } });
      await catatPerkembangan(tx, {
        laporanId: id,
        status,
        jenis: 'DIBUKA_KEMBALI',
        catatan: `Pelapor menyatakan kerusakan belum selesai${catatan ? `: ${catatan}` : ''}`,
        userId: req.user.id,
      });
      if (teknisiBaru.length) {
        for (const t of teknisiBaru) await tx.penugasan.create({ data: { laporanId: id, teknisiId: t.id } });
        status = STATUS.DITUGASKAN;
        await tx.laporan.update({ where: { id }, data: { status } });
        await catatPerkembangan(tx, {
          laporanId: id,
          status,
          jenis: 'PENUGASAN',
          catatan: `Ditugaskan ulang kepada: ${teknisiBaru.map((t) => t.nama).join(', ')}`,
          userId: req.user.id,
        });
      }
    } else {
      const status = hasil === 'SELESAI' ? STATUS.SELESAI : STATUS.SELESAI_OTOMATIS;
      await tx.laporan.update({ where: { id }, data: { status, tglDitutup: now } });
      await tx.penugasan.updateMany({ where: { laporanId: id, statusTugas: 'AKTIF' }, data: { statusTugas: 'SELESAI' } });
      await catatPerkembangan(tx, {
        laporanId: id,
        status,
        jenis: 'KONFIRMASI',
        catatan:
          hasil === 'SELESAI'
            ? `Pelapor mengonfirmasi pekerjaan selesai${catatan ? `: ${catatan}` : ''}`
            : `Tidak ada tanggapan pelapor selama ${config.autoCloseHari} hari; laporan dianggap selesai`,
        userId: req.user.id,
      });
    }
  });
}

router.post(
  '/:id/konfirmasi',
  authorize(ADMIN, PELAPOR),
  validate(konfirmasiSchema),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    await prosesKonfirmasi(req, id, req.valid.body);
    const pesan = {
      SELESAI: 'Konfirmasi selesai dicatat, laporan ditutup',
      BELUM_SELESAI: 'Laporan dibuka kembali',
      TIDAK_ADA_TANGGAPAN: 'Laporan ditutup karena tidak ada tanggapan',
    }[req.valid.body.hasil];
    ok(res, serialize(await getLaporanOrThrow(id), req), pesan, 201);
  }),
);

// Alias khusus UC-11: membuka kembali laporan
router.post(
  '/:id/buka-kembali',
  authorize(ADMIN),
  validate(konfirmasiSchema.omit({ hasil: true })),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    await prosesKonfirmasi(req, id, { ...req.valid.body, hasil: 'BELUM_SELESAI' });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Laporan dibuka kembali', 201);
  }),
);

// ---------- Pengajuan suku cadang & penahanan (REQ-19, REQ-20, BR-11) ----------

router.post(
  '/:id/pengajuan',
  authorize(ADMIN),
  validate(
    z.object({
      namaBarang: z.string().trim().min(1),
      nilai: z.coerce
        .number()
        .int()
        .refine((v) => v > AMBANG_SUKU_CADANG, {
          message: `Pengajuan ke Bagian Keuangan hanya untuk suku cadang bernilai di atas Rp${AMBANG_SUKU_CADANG.toLocaleString('id-ID')}`,
        }),
      catatan: z.string().trim().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const lap = await getLaporanOrThrow(id, includeRingkas);
    assertBelumFinal(lap);
    if (lap.status === STATUS.MENUNGGU_KONFIRMASI) throw conflict('Pekerjaan sudah dinyatakan selesai oleh teknisi');
    const b = req.valid.body;
    await prisma.$transaction(async (tx) => {
      await tx.pengajuanSukuCadang.create({ data: { ...b, laporanId: id, dicatatOlehId: req.user.id } });
      const data =
        lap.status === STATUS.DITAHAN
          ? {}
          : { status: STATUS.DITAHAN, statusSebelumDitahan: lap.status };
      if (Object.keys(data).length) await tx.laporan.update({ where: { id }, data });
      await catatPerkembangan(tx, {
        laporanId: id,
        status: STATUS.DITAHAN,
        jenis: 'DITAHAN',
        catatan: `Pekerjaan ditahan: pengajuan suku cadang "${b.namaBarang}" senilai Rp${b.nilai.toLocaleString('id-ID')} disampaikan ke Bagian Keuangan`,
        userId: req.user.id,
      });
    });
    ok(res, serialize(await getLaporanOrThrow(id), req), 'Pengajuan suku cadang dicatat, pekerjaan ditahan', 201);
  }),
);

module.exports = router;
