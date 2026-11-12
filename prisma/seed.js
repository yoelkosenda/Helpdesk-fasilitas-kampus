// Data awal: 8 gedung (BR-01), jenis kerusakan per bidang, teknisi,
// dan akun uji untuk setiap aktor (NFR-04).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || 'password123';

const GEDUNG = ['Gedung A', 'Gedung B', 'Gedung C', 'Gedung D', 'Gedung E', 'Gedung F', 'Gedung Rektorat', 'Gedung Perpustakaan'];
const RUANG = ['Ruang 101', 'Ruang 102', 'Ruang 201', 'Ruang 202', 'Toilet Lt.1', 'Koridor'];

const JENIS = [
  { namaJenis: 'Listrik padam', bidang: 'LISTRIK' },
  { namaJenis: 'Lampu mati', bidang: 'LISTRIK' },
  { namaJenis: 'Stop kontak rusak', bidang: 'LISTRIK' },
  { namaJenis: 'AC tidak dingin', bidang: 'AC' },
  { namaJenis: 'AC bocor', bidang: 'AC' },
  { namaJenis: 'AC mati', bidang: 'AC' },
  { namaJenis: 'Atap bocor', bidang: 'BANGUNAN' },
  { namaJenis: 'Pintu/jendela rusak', bidang: 'BANGUNAN' },
  { namaJenis: 'Plafon rusak', bidang: 'BANGUNAN' },
  { namaJenis: 'Air tidak mengalir', bidang: 'AIR' },
  { namaJenis: 'Pipa bocor', bidang: 'AIR' },
  { namaJenis: 'Kloset/wastafel rusak', bidang: 'AIR' },
];

const AKUN = [
  { username: 'admin', nama: 'Ibu Vonny', role: 'ADMIN' },
  { username: 'kepala', nama: 'Pak Jefry Sumual', role: 'KEPALA_UNIT' },
  { username: 'keuangan', nama: 'Staf Bagian Keuangan', role: 'KEUANGAN' },
  { username: 'pelapor', nama: 'Pelapor Uji', role: 'PELAPOR', kontak: '081200000000' },
];

const TEKNISI = [
  { username: 'teknisi.listrik', nama: 'Budi (Listrik)', bidang: 'LISTRIK' },
  { username: 'teknisi.ac', nama: 'Andi (AC)', bidang: 'AC' },
  { username: 'teknisi.bangunan', nama: 'Rudi (Bangunan)', bidang: 'BANGUNAN' },
  { username: 'teknisi.air', nama: 'Joko (Air)', bidang: 'AIR' },
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const namaGedung of GEDUNG) {
    const g = await prisma.gedung.upsert({ where: { namaGedung }, update: {}, create: { namaGedung } });
    for (const namaRuang of RUANG) {
      await prisma.ruang.upsert({
        where: { gedungId_namaRuang: { gedungId: g.id, namaRuang } },
        update: {},
        create: { gedungId: g.id, namaRuang },
      });
    }
  }

  for (const j of JENIS) {
    await prisma.jenisKerusakan.upsert({ where: { namaJenis: j.namaJenis }, update: { bidang: j.bidang }, create: j });
  }

  for (const a of AKUN) {
    const u = await prisma.user.upsert({
      where: { username: a.username },
      update: {},
      create: { username: a.username, nama: a.nama, role: a.role, password: hash },
    });
    if (a.role === 'PELAPOR') {
      await prisma.pelapor.upsert({ where: { userId: u.id }, update: {}, create: { nama: a.nama, kontak: a.kontak, userId: u.id } });
    }
  }

  for (const t of TEKNISI) {
    const u = await prisma.user.upsert({
      where: { username: t.username },
      update: {},
      create: { username: t.username, nama: t.nama, role: 'TEKNISI', password: hash },
    });
    await prisma.teknisi.upsert({ where: { userId: u.id }, update: {}, create: { nama: t.nama, bidang: t.bidang, userId: u.id } });
  }

  console.log('Seed selesai. Akun uji (password: %s):', PASSWORD);
  [...AKUN, ...TEKNISI].forEach((a) => console.log(`  - ${a.username.padEnd(18)} ${a.role || 'TEKNISI'}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
