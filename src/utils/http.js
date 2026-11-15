class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Tidak terautentikasi') => new HttpError(401, msg);
const forbidden = (msg = 'Akses ditolak untuk peran Anda') => new HttpError(403, msg);
const notFound = (msg = 'Data tidak ditemukan') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

// Membungkus handler async agar error diteruskan ke error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// NFR-11: umpan balik jelas saat berhasil disimpan.
const ok = (res, data, message, status = 200) =>
  res.status(status).json({ success: true, message: message || 'Berhasil', data });

const toInt = (v, name = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${name} tidak valid`);
  return n;
};

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler, ok, toInt };
