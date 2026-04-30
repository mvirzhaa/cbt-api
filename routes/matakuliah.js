const express = require('express');
const router = express.Router();
const matakuliahController = require('../controllers/matakuliahController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/matakuliah
router.post('/', verifyToken, isAdmin, matakuliahController.createMatakuliah);
router.get('/', verifyToken, matakuliahController.getAllMatakuliah);
router.put('/:kode_mk', verifyToken, isAdmin, matakuliahController.updateMatakuliah);
router.delete('/:kode_mk', verifyToken, isAdmin, matakuliahController.deleteMatakuliah);

// Tambahan untuk Grading dosen per matakuliah
const gradingController = require('../controllers/gradingController');
const { isDosen } = require('../middlewares/authMiddleware');
router.get('/:id/scores', verifyToken, isDosen, gradingController.getMatakuliahScores);

module.exports = router;
