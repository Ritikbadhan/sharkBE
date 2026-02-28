const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/', auth, userCtrl.getWishlist);
router.post('/', auth, userCtrl.addWishlist);
router.delete('/:productId', auth, userCtrl.removeWishlist);

module.exports = router;
