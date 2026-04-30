const express = require('express');
const router = express.Router();
const gradingController = require('../controllers/gradingController');
const { verifyToken, isDosen } = require('../middlewares/authMiddleware');

// Base URL: /api/grading
router.get('/exams/:exam_id/answers', verifyToken, isDosen, gradingController.getAnswersToGrade);
router.put('/responses/:response_id/score', verifyToken, isDosen, gradingController.submitScore);

module.exports = router;
