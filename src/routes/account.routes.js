const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/', auth, userCtrl.getAccount);

module.exports = router;
