const express = require('express');
const router = express.Router();
const cartCtrl = require('../controllers/cart.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/add', auth, cartCtrl.addItem);
router.get('/', auth, cartCtrl.getCart);
router.put('/update', auth, cartCtrl.update);
router.delete('/remove/:productId', auth, validateObjectId('productId'), cartCtrl.remove);
router.delete('/clear', auth, cartCtrl.clear);

module.exports = router;
