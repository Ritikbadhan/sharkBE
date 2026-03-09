const express = require('express');
const router = express.Router();
const checkoutCtrl = require('../controllers/checkout.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/validate', auth, checkoutCtrl.validate);
router.get('/shipping-options', auth, checkoutCtrl.shippingOptions);

module.exports = router;
