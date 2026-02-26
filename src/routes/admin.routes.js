const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/users', auth, adminCtrl.listUsers);
router.get('/orders', auth, adminCtrl.listOrders);
router.get('/dashboard-stats', auth, adminCtrl.dashboardStats);

module.exports = router;
