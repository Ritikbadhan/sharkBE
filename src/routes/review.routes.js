const express = require('express');
const router = express.Router();
const reviewCtrl = require('../controllers/review.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, reviewCtrl.create);
router.get('/:productId', reviewCtrl.listByProduct);
router.delete('/:id', auth, reviewCtrl.delete);

module.exports = router;
