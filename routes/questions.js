const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { verifyToken, isDosen } = require('../middlewares/authMiddleware');

// Base URL: /api/questions
router.get('/', verifyToken, isDosen, questionController.getQuestions);
router.post('/', verifyToken, isDosen, questionController.createQuestion);
router.put('/:id', verifyToken, isDosen, questionController.updateQuestion);
router.delete('/:id', verifyToken, isDosen, questionController.deleteQuestion);

module.exports = router;
