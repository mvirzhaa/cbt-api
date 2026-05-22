const express = require('express');
const router = express.Router();
const gradingController = require('../controllers/gradingController');
const { verifyToken, isDosen, isAdmin } = require('../middlewares/authMiddleware');
const aiService = require('../services/aiService');

// Base URL: /api/grading
router.get('/exams/:exam_id/answers', verifyToken, isDosen, gradingController.getAnswersToGrade);
router.get('/exams/:exam_id/all-answers', verifyToken, isDosen, gradingController.getAllAnswers);
router.get('/exams/:exam_id/students/:student_id/answers', verifyToken, isDosen, gradingController.getStudentAnswers);
router.put('/responses/:response_id/score', verifyToken, isDosen, gradingController.submitScore);

// AI Queue Management (Admin/Dosen only)
router.get('/ai-queue/status', verifyToken, (req, res) => {
    try {
        const status = aiService.getQueueStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/ai-queue/clear', verifyToken, isAdmin, (req, res) => {
    try {
        const result = aiService.clearQueue();
        res.json({ success: true, message: `Queue cleared. ${result.cleared} jobs removed.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
