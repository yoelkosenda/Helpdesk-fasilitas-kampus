# Helpdesk Fasilitas Kampus

## Database dan backend

Backend proyek ini menggunakan Node.js, Express, Prisma, dan SQLite lokal. Skema kanonis aplikasi berada di `prisma/schema.prisma`; backend tidak memakai database MariaDB yang tersimpan di `database/`.

Source backend dan frontend diambil dari `Helpdesk-fasilitas-kampus-main.zip`. Database MariaDB `helpdesk_fasilitas_kampus` yang sudah ada dipertahankan tanpa perubahan dan tidak digunakan oleh backend ini. SQL MariaDB di folder `database/` adalah berkas untuk database terdahulu, bukan skema yang digunakan aplikasi saat ini.

## Menyiapkan dan menjalankan

1. Gunakan Node.js 18 atau lebih baru, lalu jalankan `npm ci` dari root proyek.
2. Salin `.env.example` menjadi `.env`. Isi `JWT_SECRET` dengan nilai acak panjang dan tambahkan `SEED_PASSWORD` yang kuat. Jangan commit `.env`.
3. Jalankan `npm run setup` untuk membuat tabel SQLite dari Prisma dan mengisi data master/akun. Password akun di-hash oleh seeder.
4. Jalankan `npm test` untuk pengujian API dengan database tes terpisah. `prisma/prepare-sqlite.js` menyiapkan berkas SQLite terlebih dahulu (diperlukan pada Windows Prisma 6).
5. Jalankan `npm run dev` untuk API di `http://localhost:3000`.
6. Untuk frontend, jalankan `npm ci` lalu `npm run dev` dari folder `frontend`. Frontend memanggil API lokal secara default.

Jangan jalankan `npm run db:reset` pada database yang berisi data penting. Pengujian API menggunakan `--force-reset`, tetapi menetapkan database tes khusus `prisma/test.db` dan menghapus berkas tes itu setelah selesai.
