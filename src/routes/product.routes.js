const express = require('express');
const router = express.Router();

const productCtrl = require('../controllers/product.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, productCtrl.create);
router.get('/', productCtrl.list);
router.get('/:id', productCtrl.get);
router.put('/:id', auth, productCtrl.update);
router.delete('/:id', auth, productCtrl.delete);

module.exports = router;
