const express = require('express');
const router = express.Router();

const productCtrl = require('../controllers/product.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, productCtrl.create);
router.get('/', productCtrl.list);
router.get('/:id', validateObjectId('id'), productCtrl.get);
router.put('/:id', auth, validateObjectId('id'), productCtrl.update);
router.delete('/:id', auth, validateObjectId('id'), productCtrl.delete);

module.exports = router;
