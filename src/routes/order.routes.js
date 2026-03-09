const express = require('express');
const router = express.Router();
const orderCtrl = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, orderCtrl.create);
router.get('/', auth, orderCtrl.list);
router.get('/user', auth, orderCtrl.userOrders);
router.get('/my-orders', auth, orderCtrl.myOrders);
router.post('/coupons/validate', auth, orderCtrl.validateCoupon);
router.get('/:id/track', auth, validateObjectId('id'), orderCtrl.track);
router.get('/:id', auth, validateObjectId('id'), orderCtrl.getById);
router.put('/:id/status', auth, validateObjectId('id'), orderCtrl.updateStatus);

module.exports = router;
