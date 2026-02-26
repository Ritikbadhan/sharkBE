const express = require('express');
const router = express.Router();
const catCtrl = require('../controllers/category.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/', auth, catCtrl.create);
router.get('/', auth, catCtrl.list);
router.put('/:id', auth, catCtrl.update);
router.delete('/:id', auth, catCtrl.delete);

module.exports = router;
