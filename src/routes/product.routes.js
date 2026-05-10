const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const productCtrl = require('../controllers/product.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    cb(null, `${Date.now()}-${baseName || 'product'}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: function (_req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    return cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  }
});

const productImagesUpload = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 1 }
]);

function uploadProductImages(req, res, next) {
  productImagesUpload(req, res, (err) => {
    if (!err) return next();

    const status = err instanceof multer.MulterError ? 400 : 415;
    return res.status(status).json({ message: err.message || 'Image upload failed' });
  });
}

router.post('/', auth, uploadProductImages, productCtrl.create);
router.get('/', productCtrl.list);
router.get('/trending', productCtrl.trending);
router.get('/:id', validateObjectId('id'), productCtrl.get);
router.put('/:id', auth, validateObjectId('id'), uploadProductImages, productCtrl.update);
router.delete('/:id', auth, validateObjectId('id'), productCtrl.delete);

module.exports = router;
