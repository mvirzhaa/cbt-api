const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const termsController = require('../controllers/termsController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const handleUpload = require('../middlewares/uploadErrorHandler');

// Base URL: /api/student
router.get('/exams', verifyToken, studentController.getExams);
router.post('/verify-token', verifyToken, studentController.verifyToken);
router.get('/history', verifyToken, studentController.getHistory);

// 📜 Syarat & Ketentuan Ujian (Mahasiswa — read only)
router.get('/exam-terms/:examId', verifyToken, termsController.getTermsForStudent);

// ✅ Endpoint Submit Exam dengan Keamanan (verifyToken) & Pintu Khusus File (upload.any())
router.post('/submit-exam', verifyToken, handleUpload(upload.any(), 'message'), studentController.submitExam);

module.exports = router;