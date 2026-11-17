// Uji end-to-end alur utama berdasarkan use case SRS.
// Menggunakan database SQLite terpisah (tests/tmp/test.db).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { randomBytes } = require('node:crypto');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const tmp = path.join(__dirname, 'tmp');
const testDbPath = path.join(tmp, 'test.db');
const testSchemaPath = path.join(tmp, 'schema.sqlite.prisma');
const testClientPath = path.join(tmp, 'prisma-client');
fs.mkdirSync(tmp, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.SEED_PASSWORD = randomBytes(24).toString('hex');
// Prisma resolves SQLite paths relative to the schema file (tests/tmp/schema.sqlite.prisma).
process.env.DATABASE_URL = 'file:./test.db';
process.env.PRISMA_CLIENT_PATH = testClientPath;
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
  // Generate isolated SQLite schema & client in tests/tmp so PostgreSQL schema stays untouched.
  const baseSchema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
  const sqliteSchema = baseSchema
    .replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output   = "./prisma-client"')
    .replace(/provider\s*=\s*"postgresql"/, 'provider  = "sqlite"')
    .replace(/^\s*directUrl\s*=.*\r?\n/m, '');
  fs.writeFileSync(testSchemaPath, sqliteSchema);

  fs.rmSync(testDbPath, { force: true });
  fs.writeFileSync(testDbPath, '');
  run([prismaCli, 'generate', '--schema', testSchemaPath]);
  run([prismaCli, 'db', 'push', '--schema', testSchemaPath, '--force-reset', '--skip-generate']);
  run([path.join(root, 'prisma', 'seed.js')]);
  request = require('supertest');
  app = require('../src/app');
  prisma = require('../src/db');
  for (const u of ['admin', 'kepala', 'keuangan', 'pelapor', 'teknisi.listrik', 'teknisi.ac', 'teknisi.bangunan']) {
    const r = await request(app).post('/api/auth/login').send({ username: u, password: process.env.SEED_PASSWORD });
    assert.equal(r.status, 200, `login ${u}`);
    tok[u] = `Bearer ${r.body.data.token}`;
  }
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(testDbPath, { force: true });
});

const api = (method, url, who) => request(app)[method](url).set('Authorization', tok[who]);

async function ref() {
  const g = await api('get', '/api/master/gedung', 'admin');
  const j = await api('get', '/api/master/jenis-kerusakan', 'admin');
  const t = await api('get', '/api/master/teknisi', 'admin');
  return {
    ruang: g.body.data[0].ruang[0],
    listrikPadam: j.body.data.find((x) => x.namaJenis === 'Listrik padam'),
    tek: Object.fromEntries(
      ['LISTRIK', 'AC', 'BANGUNAN', 'AIR'].map((b) => [
        b,
        t.body.data.find((x) => x.bidang === b && ['Budi (Listrik)', 'Andi (AC)', 'Rudi (Bangunan)', 'Joko (Air)'].includes(x.nama)) ||
          t.body.data.find((x) => x.bidang === b),
      ]),
    ),
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

test('validasi update laporan & larangan ubah foto/jam kerja setelah selesai', async () => {
  const r = await ref();
  const lap = await buatLaporan(r, { prioritas: 'NORMAL' });

  // Update dengan ruangId / jenisId tidak valid ditolak 400
  assert.equal((await api('put', `/api/laporan/${lap.id}`, 'admin').send({ ruangId: 999999 })).status, 400);
  assert.equal((await api('put', `/api/laporan/${lap.id}`, 'admin').send({ jenisId: 999999 })).status, 400);

  // Selesaikan laporan
  const assign = await api('post', `/api/laporan/${lap.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id] });
  const penugasanId = assign.body.data.penugasan[0].id;
  await api('post', `/api/laporan/${lap.id}/selesai-teknisi`, 'teknisi.listrik').send({ catatan: 'Selesai' });
  await api('post', `/api/laporan/${lap.id}/konfirmasi`, 'admin').send({ hasil: 'SELESAI' });

  // Setelah SELESAI, ubah foto dan catat jam kerja ditolak 409
  const fotoRes = await api('put', `/api/laporan/${lap.id}/foto`, 'admin').attach('foto', PNG, 'foto.png');
  assert.equal(fotoRes.status, 409);
  const jamRes = await api('post', `/api/penugasan/${penugasanId}/jam-kerja`, 'teknisi.listrik').send({ durasiJam: 1 });
  assert.equal(jamRes.status, 409);
});

test('validasi upload non-gambar, SLA TINGGI & NORMAL (hari kerja), dan batal penugasan', async () => {
  const r = await ref();

  // Upload file non-gambar ditolak 400
  const nonImg = await api('post', '/api/laporan', 'admin')
    .field('sumberLaporan', 'WHATSAPP')
    .field('ruangId', r.ruang.id)
    .field('jenisId', r.listrikPadam.id)
    .field('pelaporNama', 'Pelapor File Salah')
    .attach('foto', Buffer.from('bukan gambar'), { filename: 'dok.txt', contentType: 'text/plain' });
  assert.equal(nonImg.status, 400);

  // SLA TINGGI (+24 jam) & NORMAL (+3 hari kerja melewati akhir pekan)
  const jumat = new Date('2026-11-13T09:00:00.000Z'); // Jumat
  const lapTinggi = await buatLaporan(r, { prioritas: 'TINGGI', tanggalLapor: jumat.toISOString() });
  assert.equal((new Date(lapTinggi.targetSla) - jumat) / 3.6e6, 24);

  const lapNormal = await buatLaporan(r, { prioritas: 'NORMAL', tanggalLapor: jumat.toISOString() });
  // Jumat + 3 hari kerja (Sabtu & Minggu dilewati) = Rabu (5 hari kalender)
  assert.equal((new Date(lapNormal.targetSla) - jumat) / 864e5, 5);

  // Penugasan duplikat ditolak 409, lalu batalkan penugasan terakhir -> kembali BARU
  const p1 = await api('post', `/api/laporan/${lapNormal.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id] });
  assert.equal(p1.status, 201);
  const dup = await api('post', `/api/laporan/${lapNormal.id}/penugasan`, 'admin').send({ teknisiIds: [r.tek.LISTRIK.id] });
  assert.equal(dup.status, 409);

  const pid = p1.body.data.penugasan[0].id;
  const del = await api('delete', `/api/laporan/${lapNormal.id}/penugasan/${pid}`, 'admin');
  assert.equal(del.status, 200);
  assert.equal(del.body.data.status, 'BARU');
});

test('data master, ganti password, dan akun nonaktif', async () => {
  // Buat user baru & uji ganti password + nonaktifkan akun
  const uRes = await api('post', '/api/master/users', 'admin').send({
    username: 'pelapor.qa',
    password: 'password123',
    nama: 'Pelapor QA',
    role: 'PELAPOR',
  });
  assert.equal(uRes.status, 201);
  const userId = uRes.body.data.id;

  const loginRes = await request(app).post('/api/auth/login').send({ username: 'pelapor.qa', password: 'password123' });
  assert.equal(loginRes.status, 200);
  const qaToken = `Bearer ${loginRes.body.data.token}`;

  // Ganti password: salah password lama -> 400, benar -> 200
  const wrongPw = await request(app)
    .post('/api/auth/ganti-password')
    .set('Authorization', qaToken)
    .send({ passwordLama: 'salah123', passwordBaru: 'baru12345' });
  assert.equal(wrongPw.status, 400);

  const okPw = await request(app)
    .post('/api/auth/ganti-password')
    .set('Authorization', qaToken)
    .send({ passwordLama: 'password123', passwordBaru: 'baru12345' });
  assert.equal(okPw.status, 200);

  assert.equal(
    (await request(app).post('/api/auth/login').send({ username: 'pelapor.qa', password: 'baru12345' })).status,
    200,
  );

  // Admin tidak bisa menonaktifkan akun sendiri
  const meAdmin = (await api('get', '/api/auth/me', 'admin')).body.data;
  assert.equal((await api('patch', `/api/master/users/${meAdmin.id}/aktif`, 'admin').send({ aktif: false })).status, 400);

  // Nonaktifkan user QA -> login ditolak 401
  assert.equal((await api('patch', `/api/master/users/${userId}/aktif`, 'admin').send({ aktif: false })).status, 200);
  assert.equal(
    (await request(app).post('/api/auth/login').send({ username: 'pelapor.qa', password: 'baru12345' })).status,
    401,
  );

  // Teknisi nonaktif tidak boleh ditugaskan
  const tekNonaktif = await api('post', '/api/master/teknisi', 'admin').send({
    nama: 'Teknisi Nonaktif',
    bidang: 'AIR',
    aktif: false,
  });
  assert.equal(tekNonaktif.status, 201);
  const r = await ref();
  const lap = await buatLaporan(r);
  assert.equal(
    (await api('post', `/api/laporan/${lap.id}/penugasan`, 'admin').send({ teknisiIds: [tekNonaktif.body.data.id] })).status,
    400,
  );
});
