const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { verifyToken, isDosen, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/exams
router.get('/', verifyToken, isDosenOrSuperAdmin, examController.getAllExams);
router.post('/', verifyToken, isDosen, examController.createExam);
router.put('/:id', verifyToken, isDosenOrSuperAdmin, examController.updateExam);
router.get('/:exam_id/rekap-detail', verifyToken, isDosen, examController.getExamRekapDetail);

module.exports = router;
