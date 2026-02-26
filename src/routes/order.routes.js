const express = require('express');
const router = express.Router();
const orderCtrl = require('../controllers/order.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, orderCtrl.create);
router.get('/my-orders', auth, orderCtrl.myOrders);
router.get('/:id', auth, orderCtrl.getById);
router.put('/:id/status', auth, orderCtrl.updateStatus);

module.exports = router;
