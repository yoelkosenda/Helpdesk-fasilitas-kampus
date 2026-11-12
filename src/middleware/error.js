const multer = require('multer');
const { HttpError } = require('../utils/http');

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan` });
}

// NFR-11: pesan gagal yang jelas
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto melebihi batas' : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  if (err && err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Data duplikat', details: err.meta });
  }
  if (err && err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
  }
  if (err && err.code === 'P2003') {
    return res.status(409).json({ success: false, message: 'Data masih direferensikan atau relasi tidak valid' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON tidak valid' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server, data gagal disimpan' });
}

module.exports = { notFoundHandler, errorHandler };
