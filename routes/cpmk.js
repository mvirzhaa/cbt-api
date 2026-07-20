const express = require('express');
const router = express.Router();
const cpmkController = require('../controllers/cpmkController');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/cpmk
router.get('/', verifyToken, isDosenOrSuperAdmin, cpmkController.getCpmk);
router.post('/', verifyToken, isDosenOrSuperAdmin, cpmkController.createCpmk);
router.put('/sub-cpmk/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.updateSubCpmk);
router.delete('/sub-cpmk/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.deleteSubCpmk);
router.put('/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.updateCpmk);
router.delete('/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.deleteCpmk);
router.post('/:cpmk_id/sub-cpmk', verifyToken, isDosenOrSuperAdmin, cpmkController.createSubCpmk);

module.exports = router;
