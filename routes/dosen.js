const express = require('express');
const router = express.Router();
const dosenController = require('../controllers/dosenController');
const termsController = require('../controllers/termsController');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/dosen

// GET  /api/dosen/attempts/:exam_id       — Daftar attempt mahasiswa untuk satu ujian
router.get('/attempts/:exam_id', verifyToken, isDosenOrSuperAdmin, dosenController.getAttemptsByExam);

// POST /api/dosen/verify-exam/:attempt_id — Verifikasi & publish nilai mahasiswa
router.post('/verify-exam/:attempt_id', verifyToken, isDosenOrSuperAdmin, dosenController.verifyExam);

// POST /api/dosen/reset-attempt/:attempt_id — Hapus attempt, izinkan mahasiswa ujian ulang
router.post('/reset-attempt/:attempt_id', verifyToken, isDosenOrSuperAdmin, dosenController.resetAttempt);

// 📜 Syarat & Ketentuan Ujian (Dosen — baca & kelola)
router.get('/exam-terms/:examId', verifyToken, isDosenOrSuperAdmin, termsController.getTermsForDosen);
router.post('/exam-terms/:examId', verifyToken, isDosenOrSuperAdmin, termsController.saveTermsForDosen);

module.exports = router;

