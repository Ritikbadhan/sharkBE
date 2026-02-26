const express = require('express');
const router = express.Router();
const reviewCtrl = require('../controllers/review.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, reviewCtrl.create);
router.get('/:productId', validateObjectId('productId'), reviewCtrl.listByProduct);
router.delete('/:id', auth, validateObjectId('id'), reviewCtrl.delete);

module.exports = router;
