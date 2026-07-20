const express = require('express');
const router = express.Router();
const questionBankController = require('../controllers/questionBankController');
const { verifyToken, isDosen } = require('../middlewares/authMiddleware');

// Base URL: /api/question-bank
router.get('/', verifyToken, isDosen, questionBankController.getBankSoal);
router.post('/', verifyToken, isDosen, questionBankController.createBankSoal);
router.post('/import', verifyToken, isDosen, questionBankController.importFromBank);
router.post('/generate-ai', verifyToken, isDosen, questionBankController.generateAI);
router.put('/:id', verifyToken, isDosen, questionBankController.updateBankSoal);
router.delete('/:id', verifyToken, isDosen, questionBankController.deleteBankSoal);

module.exports = router;
