const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../db');
const { unauthorized, forbidden } = require('../utils/http');

// NFR-05: autentikasi berbasis token JWT (header Authorization: Bearer <token>)
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Token tidak valid atau kedaluwarsa');
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { teknisi: true, pelapor: true },
    });
    if (!user || !user.aktif) throw unauthorized('Akun tidak aktif');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// NFR-06: pembatasan akses berdasarkan peran
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

module.exports = { authenticate, authorize };
