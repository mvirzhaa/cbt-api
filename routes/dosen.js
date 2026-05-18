const express = require('express');
const router = express.Router();
const dosenController = require('../controllers/dosenController');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/dosen

// GET  /api/dosen/attempts/:exam_id       — Daftar attempt mahasiswa untuk satu ujian
router.get('/attempts/:exam_id', verifyToken, isDosenOrSuperAdmin, dosenController.getAttemptsByExam);

// POST /api/dosen/verify-exam/:attempt_id — Verifikasi & publish nilai mahasiswa
router.post('/verify-exam/:attempt_id', verifyToken, isDosenOrSuperAdmin, dosenController.verifyExam);

module.exports = router;
