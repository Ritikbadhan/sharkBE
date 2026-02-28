const express = require('express');
const router = express.Router();
const returnCtrl = require('../controllers/return.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, returnCtrl.create);
router.get('/my', auth, returnCtrl.myReturns);

module.exports = router;
