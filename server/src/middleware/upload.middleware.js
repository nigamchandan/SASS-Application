const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ApiError = require('../utils/ApiError');

const LOGO_DIR = path.join(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.png';
    const id = crypto.randomBytes(8).toString('hex');
    const userPart = req.user?.id ? `${req.user.id.slice(-6)}-` : '';
    cb(null, `logo-${userPart}${id}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new ApiError(400, 'Only PNG, JPG, WEBP or SVG files are allowed'));
  }
  cb(null, true);
};

const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

module.exports = { uploadLogo };
