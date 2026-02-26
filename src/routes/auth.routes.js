const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/logout', auth, authCtrl.logout);
router.get('/me', auth, authCtrl.me);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);

module.exports = router;
