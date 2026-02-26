const express = require('express');
const router = express.Router();
const addrCtrl = require('../controllers/address.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, addrCtrl.create);
router.get('/', auth, addrCtrl.list);
router.put('/:id', auth, validateObjectId('id'), addrCtrl.update);
router.delete('/:id', auth, validateObjectId('id'), addrCtrl.delete);

module.exports = router;
