const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { z } = require('zod');
const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { authenticate } = require('./middleware/auth');
const { ok } = require('./utils/http');
const { hitungTargetSla, LABEL_SLA } = require('./utils/sla');
const C = require('./constants');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Foto kerusakan (BR-03)
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

app.get('/', (req, res) =>
  res.json({ name: 'Helpdesk Fasilitas Kampus API', version: '1.0.0', docs: '/api/health', status: 'ok' }),
);
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Referensi nilai enum & pratinjau SLA untuk form frontend (REQ-05)
app.get('/api/referensi', authenticate, (req, res) => {
  const sekarang = new Date();
  ok(res, {
    role: Object.values(C.ROLE),
    bidang: C.BIDANG,
    sumberLaporan: C.SUMBER_LAPORAN,
    prioritas: C.PRIORITAS.map((p) => ({ kode: p, targetLabel: LABEL_SLA[p], contohTarget: hitungTargetSla(p, sekarang) })),
    status: Object.values(C.STATUS),
    hasilKonfirmasi: C.HASIL_KONFIRMASI,
    jenisPerkembangan: C.JENIS_PERKEMBANGAN,
    ambangSukuCadang: C.AMBANG_SUKU_CADANG,
    wajibFoto: config.wajibFoto,
    autoClose: { hari: config.autoCloseHari, mode: config.autoCloseMode },
  });
});

app.get('/api/sla/pratinjau', authenticate, (req, res, next) => {
  const r = z
    .object({ prioritas: z.enum(C.PRIORITAS), mulai: z.coerce.date().optional() })
    .safeParse(req.query);
  if (!r.success) return next(require('./utils/http').badRequest('prioritas wajib DARURAT/TINGGI/NORMAL'));
  ok(res, { prioritas: r.data.prioritas, label: LABEL_SLA[r.data.prioritas], targetSla: hitungTargetSla(r.data.prioritas, r.data.mulai || new Date()) });
});

app.use('/api/auth', require('./routes/auth').router);
app.use('/api/master', require('./routes/master'));
app.use('/api/laporan', require('./routes/laporan'));
app.use('/api/manajemen', require('./routes/manajemen'));
app.use('/api', require('./routes/pekerjaan'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
