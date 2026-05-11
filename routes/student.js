const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Base URL: /api/student
router.get('/exams', verifyToken, studentController.getExams);
router.post('/verify-token', verifyToken, studentController.verifyToken);
router.get('/history', verifyToken, studentController.getHistory);

// ✅ Endpoint Submit Exam dengan Keamanan (verifyToken) & Pintu Khusus File (upload.any())
router.post('/submit-exam', verifyToken, upload.any(), studentController.submitExam);

module.exports = router;