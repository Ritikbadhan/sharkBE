const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.get('/users', auth, adminCtrl.listUsers);
router.put('/users/:id', auth, validateObjectId('id'), adminCtrl.updateUser);
router.get('/orders', auth, adminCtrl.listOrders);
router.post('/orders', auth, adminCtrl.ordersAction);
router.get('/orders/:id', auth, validateObjectId('id'), adminCtrl.getOrderById);
router.put('/orders/:id', auth, validateObjectId('id'), adminCtrl.updateOrder);
router.get('/reviews', auth, adminCtrl.listReviews);
router.put('/reviews/:id', auth, validateObjectId('id'), adminCtrl.updateReview);
router.delete('/reviews/:id', auth, validateObjectId('id'), adminCtrl.deleteReview);
router.get('/inventory', auth, adminCtrl.listInventory);
router.put('/inventory', auth, adminCtrl.updateInventory);
router.get('/dashboard-stats', auth, adminCtrl.dashboardStats);
router.post('/promote', auth, adminCtrl.promoteUser);

module.exports = router;
