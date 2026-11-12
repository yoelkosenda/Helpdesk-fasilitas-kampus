const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db');
const config = require('../config');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ok, unauthorized, badRequest } = require('../utils/http');

const router = express.Router();

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  nama: u.nama,
  role: u.role,
  teknisiId: u.teknisi ? u.teknisi.id : null,
  bidang: u.teknisi ? u.teknisi.bidang : null,
  pelaporId: u.pelapor ? u.pelapor.id : null,
});

router.post(
  '/login',
  validate(z.object({ username: z.string().min(1), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { username, password } = req.valid.body;
    const user = await prisma.user.findUnique({ where: { username }, include: { teknisi: true, pelapor: true } });
    if (!user || !user.aktif || !(await bcrypt.compare(password, user.password))) {
      throw unauthorized('Username atau password salah');
    }
    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    ok(res, { token, user: publicUser(user) }, 'Login berhasil');
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => ok(res, publicUser(req.user))),
);

router.post(
  '/ganti-password',
  authenticate,
  validate(z.object({ passwordLama: z.string().min(1), passwordBaru: z.string().min(6) })),
  asyncHandler(async (req, res) => {
    const { passwordLama, passwordBaru } = req.valid.body;
    if (!(await bcrypt.compare(passwordLama, req.user.password))) throw badRequest('Password lama salah');
    await prisma.user.update({ where: { id: req.user.id }, data: { password: await bcrypt.hash(passwordBaru, 10) } });
    ok(res, null, 'Password berhasil diganti');
  }),
);

module.exports = { router, publicUser };
