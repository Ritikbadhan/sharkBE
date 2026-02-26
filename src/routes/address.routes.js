const express = require('express');
const router = express.Router();
const addrCtrl = require('../controllers/address.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, addrCtrl.create);
router.get('/', auth, addrCtrl.list);
router.put('/:id', auth, addrCtrl.update);
router.delete('/:id', auth, addrCtrl.delete);

module.exports = router;
