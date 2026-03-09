const express = require('express');
const router = express.Router();
const reviewCtrl = require('../controllers/review.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, reviewCtrl.create);
router.get('/product/:productId', validateObjectId('productId'), reviewCtrl.listByProduct);
router.delete('/:reviewId', auth, validateObjectId('reviewId'), reviewCtrl.delete);

module.exports = router;
