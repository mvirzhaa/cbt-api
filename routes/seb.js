const express = require('express');
const router = express.Router();
const sebController = require('../controllers/sebController');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/seb

router.put('/exams/:exam_id/settings', verifyToken, isDosenOrSuperAdmin, sebController.setExamSebSettings);
router.get('/exams/:exam_id/config', verifyToken, isDosenOrSuperAdmin, sebController.downloadExamSebConfig);

module.exports = router;
