const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payment.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/create', auth, paymentCtrl.create);
router.post('/verify', auth, paymentCtrl.verify);
router.get('/:orderId', auth, paymentCtrl.getByOrder);

module.exports = router;
