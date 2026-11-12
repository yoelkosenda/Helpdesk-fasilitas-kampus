// Uji end-to-end alur utama berdasarkan use case SRS.
// Menggunakan database SQLite terpisah (tests/tmp/test.db).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const tmp = path.join(__dirname, 'tmp');
fs.mkdirSync(tmp, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.AKTIFKAN_SCHEDULER = 'false';
process.env.JWT_SECRET = 'test-secret';

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const run = (args) => execFileSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'pipe' });

let request;
let app;
let prisma;
const tok = {};
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

before(async () => {
  run([prismaCli, 'db', 'push', '--force-reset', '--skip-generate']);
  run([path.join(root, 'prisma', 'seed.js')]);
  request = require('supertest');
  app = require('../src/app');
  prisma = require('../src/db');
  for (const u of ['admin', 'kepala', 'keuangan', 'pelapor', 'teknisi.listrik', 'teknisi.ac', 'teknisi.bangunan']) {
    const r = await request(app).post('/api/auth/login').send({ username: u, password: 'password123' });
    assert.equal(r.status, 200, `login ${u}`);
    tok[u] = `Bearer ${r.body.data.token}`;
  }
});

after(async () => {
  if (prisma) await prisma.$disconnect();
});

const api = (method, url, who) => request(app)[method](url).set('Authorization', tok[who]);

async function ref() {
  const g = await api('get', '/api/master/gedung', 'admin');
  const j = await api('get', '/api/master/jenis-kerusakan', 'admin');
  const t = await api('get', '/api/master/teknisi', 'admin');
  return {
    ruang: g.body.data[0].ruang[0],
    listrikPadam: j.body.data.find((x) => x.namaJenis === 'Listrik padam'),
    tek: Object.fromEntries(t.body.data.map((x) => [x.bidang, x])),
  };
}

async function buatLaporan(r, extra = {}) {
  const req = api('post', '/api/laporan', 'admin')
    .field('sumberLaporan', 'WHATSAPP')
    .field('ruangId', r.ruang.id)
    .field('jenisId', r.listrikPadam.id)
    .field('deskripsi', 'Listrik padam satu gedung')
    .field('pelaporNama', 'Mahasiswa Uji')
    .attach('foto', PNG, 'foto.png');
  for (const [k, v] of Object.entries(extra)) req.field(k, v);
  const res = await req;
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

test('login gagal & akses tanpa token ditolak', async () => {
  const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'salah' });
  assert.equal(r.status, 401);
  assert.equal((await request(app).get('/api/laporan')).status, 401);
});

test('alur lengkap laporan: catat → prioritas → tugaskan → progres → ditahan → selesai → dibuka kembali → konfirmasi', async () => {
  const r = await ref();

  // BR-03: foto wajib
  const tanpaFoto = await api('post', '/api/laporan', 'admin').send({
    sumberLaporan: 'TELEPON',
    ruangId: r.ruang.id,
    jenisId: r.listrikPadam.id,
    pelaporNama: 'X',
  });
  assert.equal(tanpaFoto.status, 400);

  // UC-03
  let lap = await buatLaporan(r);
  assert.equal(lap.status, 'BARU');
  assert.ok(lap.kode.startsWith('LPR-'));
  assert.ok(lap.fotoUrl);
  let res = await api('patch', `/api/laporan/${lap.id}/prioritas`, 'admin').send({ prioritas: 'DARURAT' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.sla.labelSla, '4 jam');
  const selisihJam = (new Date(res.body.data.targetSla) - new Date(res.body.data.tanggalLapor)) / 3.6e6;
  assert.equal(selisihJam, 4);

  // Teknisi hanya boleh melihat laporan yang ditugaskan
  assert.equal((await api('get', `/api/laporan/${lap.id}`, 'teknisi.listrik')).status, 403);

  // UC-04: dua teknisi (BR-09) – AC berbeda bidang → peringatan
  res = await api('post', `/api/laporan/${lap.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id, r.tek.AC.id] });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'DITUGASKAN');
  assert.equal(res.body.data.teknisiAktif.length, 2);
  assert.equal(res.body.data.peringatan.length, 1);

  // UC-10
  res = await api('get', '/api/pekerjaan-saya', 'teknisi.listrik');
  assert.equal(res.status, 200);
  const job = res.body.data.find((p) => p.laporan.id === lap.id);
  assert.ok(job);
  assert.equal((await api('get', `/api/laporan/${lap.id}`, 'teknisi.bangunan')).status, 403);

  // UC-05/06: progres
  res = await api('post', `/api/laporan/${lap.id}/perkembangan`, 'teknisi.listrik').send({ jenis: 'PEMERIKSAAN', catatan: 'MCB trip' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'DIKERJAKAN');
  assert.equal(
    (await api('post', `/api/laporan/${lap.id}/perkembangan`, 'teknisi.bangunan').send({ catatan: 'x' })).status,
    403,
  );

  // UC-07: jam kerja per teknisi
  res = await api('post', `/api/penugasan/${job.penugasanId}/jam-kerja`, 'teknisi.listrik').send({ durasiJam: 2.5 });
  assert.equal(res.status, 201);
  const pAc = (await api('get', '/api/pekerjaan-saya', 'teknisi.ac')).body.data.find((p) => p.laporan.id === lap.id);
  assert.equal((await api('post', `/api/penugasan/${pAc.penugasanId}/jam-kerja`, 'teknisi.listrik').send({ durasiJam: 1 })).status, 403);
  assert.equal((await api('post', `/api/penugasan/${pAc.penugasanId}/jam-kerja`, 'teknisi.ac').send({ durasiJam: 1.5 })).status, 201);

  // UC-09: suku cadang ≤ 500rb ditolak, > 500rb → ditahan
  res = await api('post', `/api/laporan/${lap.id}/pengajuan`, 'admin').send({ namaBarang: 'MCB', nilai: 500000 });
  assert.equal(res.status, 400);
  res = await api('post', `/api/laporan/${lap.id}/pengajuan`, 'admin').send({ namaBarang: 'Panel MCB', nilai: 1750000 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'DITAHAN');
  assert.equal((await api('post', `/api/laporan/${lap.id}/selesai-teknisi`, 'teknisi.listrik').send({ catatan: 'ok' })).status, 409);

  const daftarPengajuan = await api('get', '/api/pengajuan?status=MENUNGGU', 'keuangan');
  assert.equal(daftarPengajuan.status, 200);
  const peng = daftarPengajuan.body.data.find((p) => p.laporanId === lap.id);
  res = await api('patch', `/api/pengajuan/${peng.id}/tindak-lanjut`, 'keuangan').send({ catatan: 'Disetujui' });
  assert.equal(res.status, 200);
  lap = (await api('get', `/api/laporan/${lap.id}`, 'admin')).body.data;
  assert.equal(lap.status, 'DIKERJAKAN');

  // Selesai oleh teknisi (REQ-09 via endpoint status)
  res = await api('patch', `/api/laporan/${lap.id}/status`, 'teknisi.listrik').send({ status: 'MENUNGGU_KONFIRMASI', catatan: 'Panel diganti' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'MENUNGGU_KONFIRMASI');

  // TIDAK_ADA_TANGGAPAN belum boleh (< 3 hari)
  assert.equal((await api('post', `/api/laporan/${lap.id}/konfirmasi`, 'admin').send({ hasil: 'TIDAK_ADA_TANGGAPAN' })).status, 409);

  // UC-11: dibuka kembali + ditugaskan ulang
  res = await api('post', `/api/laporan/${lap.id}/konfirmasi`, 'admin').send({
    hasil: 'BELUM_SELESAI',
    catatan: 'Masih padam di lantai 2',
    teknisiIds: [r.tek.LISTRIK.id],
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'DITUGASKAN');
  assert.equal(res.body.data.teknisiAktif.length, 1);

  await api('post', `/api/laporan/${lap.id}/selesai-teknisi`, 'teknisi.listrik').send({ catatan: 'Kabel lantai 2 diperbaiki' });
  res = await api('post', `/api/laporan/${lap.id}/konfirmasi`, 'admin').send({ hasil: 'SELESAI' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'SELESAI');
  assert.equal(res.body.data.konfirmasi.length, 2);
  assert.ok(res.body.data.perkembangan.length >= 8);
});

test('penutupan otomatis setelah 3 hari tanpa tanggapan (BR-14)', async () => {
  const r = await ref();
  const lap = await buatLaporan(r, { prioritas: 'NORMAL' });
  await api('post', `/api/laporan/${lap.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id] });
  await api('post', `/api/laporan/${lap.id}/selesai-teknisi`, 'teknisi.listrik').send({ catatan: 'Selesai' });
  await prisma.laporan.update({ where: { id: lap.id }, data: { tglSelesaiTeknisi: new Date(Date.now() - 4 * 864e5) } });
  const res = await api('post', '/api/manajemen/auto-close/jalankan', 'admin');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.ditutup.includes(lap.kode));
  const detail = (await api('get', `/api/laporan/${lap.id}`, 'admin')).body.data;
  assert.equal(detail.status, 'SELESAI_OTOMATIS');
  assert.equal(detail.konfirmasi.at(-1).hasil, 'TIDAK_ADA_TANGGAPAN');
});

test('pelapor: hanya melihat laporannya sendiri dan dapat konfirmasi', async () => {
  const r = await ref();
  const me = (await api('get', '/api/auth/me', 'pelapor')).body.data;
  const lap = await buatLaporan(r, { pelaporId: me.pelaporId, prioritas: 'TINGGI' });
  const list = await api('get', '/api/laporan', 'pelapor');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.every((l) => l.pelaporId === me.pelaporId));
  await api('post', `/api/laporan/${lap.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id] });
  await api('post', `/api/laporan/${lap.id}/selesai-teknisi`, 'teknisi.listrik').send({ catatan: 'ok' });
  const res = await api('post', `/api/laporan/${lap.id}/konfirmasi`, 'pelapor').send({ hasil: 'SELESAI' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'SELESAI');
});

test('Kepala Unit: dashboard, terlambat, laporan bulanan, rekap jam kerja', async () => {
  const r = await ref();
  // Laporan darurat yang sudah 10 jam → terlambat (REQ-15)
  const lap = await buatLaporan(r, { prioritas: 'DARURAT', tanggalLapor: new Date(Date.now() - 10 * 3.6e6).toISOString() });

  let res = await api('get', '/api/manajemen/dashboard', 'kepala');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.peringatanTerlambat.some((x) => x.id === lap.id));

  res = await api('get', '/api/manajemen/terlambat', 'kepala');
  assert.ok(res.body.data.some((x) => x.id === lap.id));

  res = await api('get', '/api/manajemen/belum-selesai', 'kepala');
  assert.ok(res.body.data.some((x) => x.id === lap.id));

  const now = new Date();
  const bulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  res = await api('get', `/api/manajemen/laporan-bulanan?bulan=${bulan}`, 'kepala');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.total >= 1);
  assert.ok(res.body.data.perGedung.length >= 1);
  assert.ok(res.body.data.perJenis.length >= 1);

  res = await api('get', '/api/manajemen/laporan-bulanan?bulan=2000-01', 'kepala');
  assert.equal(res.body.data.total, 0);
  assert.equal(res.body.message, 'Data tidak tersedia untuk periode ini');

  res = await api('get', '/api/manajemen/rekap-jam-kerja', 'kepala');
  assert.equal(res.status, 200);
  const listrik = res.body.data.perTeknisi.find((t) => t.bidang === 'LISTRIK');
  assert.equal(listrik.totalJam, 2.5);
  assert.ok(res.body.data.perPekerjaan.length >= 2);

  // RBAC
  assert.equal((await api('get', '/api/manajemen/dashboard', 'teknisi.listrik')).status, 403);
  assert.equal((await api('post', '/api/laporan', 'kepala').send({})).status, 403);
});
