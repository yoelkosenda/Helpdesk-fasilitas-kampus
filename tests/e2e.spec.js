const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const SEED_PASSWORD = process.env.SEED_PASSWORD;
const PNG_PATH = path.join(__dirname, 'tmp', 'e2e-foto.png');

test.beforeAll(() => {
  fs.mkdirSync(path.dirname(PNG_PATH), { recursive: true });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(PNG_PATH, png);
});

async function loginAs(page, username, password = SEED_PASSWORD) {
  await page.goto('/');
  await page.getByPlaceholder('Masukkan username').fill(username);
  await page.locator('input[type="password"], input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /Masuk ke dashboard/i }).click();
}

test('Playwright E2E: login gagal, alur penuh Admin → Teknisi → Konfirmasi, Manajemen, Master & Mobile', async ({ page }) => {
  // 1. Login gagal
  await loginAs(page, 'admin', 'password-salah');
  await expect(page.locator('.inline-error')).toContainText(/Username atau password salah/i);

  // 2. Login sebagai Admin
  await loginAs(page, 'admin');
  await expect(page.getByRole('heading', { name: /Selamat pagi/i })).toBeVisible();

  // Klik "Catat laporan" dari Dashboard harus membuka modal ReportForm
  await page.getByRole('button', { name: /Catat laporan/i }).first().click();
  await expect(page.getByRole('heading', { name: /Catat laporan kerusakan/i })).toBeVisible();

  const deskripsiUnik = `E2E Playwright Lampu Rusak ${Date.now()}`;
  const modal = page.locator('.modal');
  await modal.locator('select').nth(0).selectOption('WHATSAPP');
  await modal.locator('select').nth(1).selectOption('DARURAT');
  await modal.locator('select').nth(2).selectOption({ index: 1 }); // Gedung pertama
  await expect(modal.locator('select').nth(3).locator('option')).not.toHaveCount(1);
  await modal.locator('select').nth(3).selectOption({ index: 1 }); // Ruang pertama
  await modal.locator('select').nth(4).selectOption({ index: 1 }); // Jenis kerusakan pertama
  await modal.getByPlaceholder('Nama pelapor').fill('Mahasiswa Playwright');
  await modal.getByPlaceholder(/Jelaskan kondisi kerusakan/i).fill(deskripsiUnik);
  await modal.locator('input[type="file"]').setInputFiles(PNG_PATH);
  await modal.getByRole('button', { name: /Simpan laporan/i }).click();

  // Tunggu modal tertutup dan laporan muncul di daftar
  await expect(modal).toBeHidden();
  const row = page.locator('tbody tr', { hasText: 'Mahasiswa Playwright' }).first();
  await expect(row).toBeVisible();
  const kodeLaporan = (await row.locator('strong.linkish').textContent()).trim();
  await row.click();

  // 3. Detail Laporan: cek timeline bukan '-' dan tugaskan teknisi pertama
  await expect(page.getByRole('heading', { name: kodeLaporan })).toBeVisible();
  const timelineDate = await page.locator('.timeline-item small').first().textContent();
  expect(timelineDate).not.toMatch(/^-/);

  const firstTech = page.locator('.assignment-options input[type="checkbox"]').first();
  await firstTech.check();
  await page.getByRole('button', { name: /Simpan penugasan/i }).click();
  await expect(page.locator('.toast')).toContainText(/Penugasan berhasil disimpan/i);

  // 4. Logout & Login sebagai Teknisi (ambil sesuai bidang jenis pertama, cek semua teknisi atau cek yang ditugaskan)
  // Cari nama teknisi yang ditugaskan dari panel penugasan
  const assigneeName = (await page.locator('.assignee strong').first().textContent()).trim();
  const techUserMap = {
    Budi: 'teknisi.listrik',
    Andi: 'teknisi.ac',
    Rudi: 'teknisi.bangunan',
    Joko: 'teknisi.air',
  };
  const techUsername = Object.entries(techUserMap).find(([nama]) => assigneeName.includes(nama))?.[1] || 'teknisi.listrik';

  await page.getByRole('button', { name: /Keluar/i }).click();
  await loginAs(page, techUsername);
  await expect(page.getByRole('heading', { name: /Pekerjaan Saya/i })).toBeVisible();

  const jobRow = page.locator('tbody tr', { hasText: kodeLaporan }).first();
  await expect(jobRow).toBeVisible();
  await jobRow.click();

  // Catat jam kerja 2.5 jam
  await page.getByPlaceholder('Contoh: 2.5').fill('2.5');
  await page.getByRole('button', { name: /Simpan jam kerja/i }).click();
  await expect(page.locator('.toast')).toContainText(/Jam kerja berhasil dicatat/i);

  // Tambah progres
  await page.getByPlaceholder(/Tambahkan catatan perkembangan/i).fill('Sedang diperbaiki via Playwright');
  await page.getByRole('button', { name: /Simpan progres/i }).click();
  await expect(page.locator('.toast')).toContainText(/Perubahan berhasil disimpan/i);

  // Klik Kembali -> harus kembali ke Pekerjaan Saya & kolom Jam saya tampil 2.5 jam
  await page.getByRole('button', { name: /Kembali/i }).click();
  await expect(page.getByRole('heading', { name: /Pekerjaan Saya/i })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: kodeLaporan }).first()).toContainText('2.5 jam');

  // Buka lagi & tandai selesai
  await page.locator('tbody tr', { hasText: kodeLaporan }).first().click();
  await page.getByPlaceholder(/Tambahkan catatan perkembangan/i).fill('Perbaikan selesai 100%');
  await page.getByRole('button', { name: /Tandai selesai/i }).click();
  await expect(page.locator('.toast')).toContainText(/Perubahan berhasil disimpan/i);

  // 5. Login ulang sebagai Admin -> konfirmasi SELESAI & cek Manajemen / Data Master
  await page.getByRole('button', { name: /Keluar/i }).click();
  await loginAs(page, 'admin');
  await page.getByRole('button', { name: /Laporan Kerusakan/i }).click();
  await page.locator('tbody tr', { hasText: kodeLaporan }).first().click();

  await page.getByRole('button', { name: /Simpan konfirmasi/i }).click();
  await expect(page.locator('.toast')).toContainText(/Laporan dikonfirmasi selesai/i);
  await expect(page.locator('.detail-summary .badge').first()).toContainText('Selesai');

  await page.getByRole('button', { name: /Laporan Manajemen/i }).click();
  await expect(page.getByRole('heading', { name: /Laporan Manajemen/i })).toBeVisible();
  await page.getByRole('button', { name: /Rekap jam kerja/i }).click();
  await expect(page.getByRole('heading', { name: /Rekap jam kerja teknisi/i })).toBeVisible();

  await page.getByRole('button', { name: /Data Master/i }).click();
  await expect(page.getByRole('heading', { name: /Data Master/i })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();

  // 6. Uji responsivitas mobile (375x812)
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('.topbar')).toBeVisible();
});
