const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Base URL: /api/student
router.get('/exams', verifyToken, studentController.getExams);
router.post('/verify-token', verifyToken, studentController.verifyToken);
router.post('/submit-exam', verifyToken, upload.any(), studentController.submitExam);
router.get('/history', verifyToken, studentController.getHistory);

module.exports = router;
