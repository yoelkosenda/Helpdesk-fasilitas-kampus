const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { badRequest } = require('../utils/http');
const { isSupabaseEnabled, createFilename } = require('../services/storage');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const storage = isSupabaseEnabled()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.resolve(config.uploadDir);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, createFilename(file.originalname)),
    });

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) return cb(badRequest('Foto harus berformat JPG, PNG, WEBP, atau HEIC'));
    cb(null, true);
  },
});

module.exports = upload;
