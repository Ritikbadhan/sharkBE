const express = require('express');
const router = express.Router();
const catCtrl = require('../controllers/category.controller');
const auth = require('../middlewares/auth.middleware');
const validateObjectId = require('../middlewares/validateObjectId.middleware');

router.post('/', auth, catCtrl.create);
router.get('/', catCtrl.list);
router.put('/:id', auth, validateObjectId('id'), catCtrl.update);
router.delete('/:id', auth, validateObjectId('id'), catCtrl.delete);

module.exports = router;
