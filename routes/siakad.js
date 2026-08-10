const express = require('express');
const router = express.Router();
const siakadController = require('../controllers/siakadController');
const { verifyToken, isDosenOrSuperAdmin, isAdmin } = require('../middlewares/authMiddleware');
const siakadQueueService = require('../services/siakadQueueService');

// Base URL: /api/siakad

// Dipakai bareng oleh picker matkul di ManageMatkul.jsx (dosen) DAN
// AdminDashboard.jsx (admin) — read-only proxy pencarian, jadi digerbang
// admin/dosen/super_admin, bukan cuma isAdmin (yang bikin dosen selalu 403).
const isAdminOrDosen = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Harus login terlebih dahulu!" });
    if (!['admin', 'dosen', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses Ditolak! Fitur ini khusus Admin/Dosen." });
    }
    next();
};

router.put('/exams/:exam_id/target', verifyToken, isDosenOrSuperAdmin, siakadController.setExamSiakadTarget);
router.post('/attempts/:attempt_id/push', verifyToken, isDosenOrSuperAdmin, siakadController.pushAttempt);
router.post('/exams/:exam_id/push', verifyToken, isDosenOrSuperAdmin, siakadController.pushExamAttempts);

// Rencana Evaluasi (setup sebelum push nilai)
router.get('/rencana-evaluasi', verifyToken, isDosenOrSuperAdmin, siakadController.getRencanaEvaluasi);

// Pemetaan CPMK live (picker Sub-CPMK saat bikin soal) & auto-provision
router.get('/mata-kuliah/:kode_mk/pemetaan-cpmk', verifyToken, isDosenOrSuperAdmin, siakadController.getPemetaanCpmk);
router.post('/mata-kuliah/:kode_mk/resolve-cpmk', verifyToken, isDosenOrSuperAdmin, siakadController.resolveCpmkFromSiakad);

// Pull mata kuliah (untuk picker di form matkul lokal)
router.get('/matakuliah', verifyToken, isAdminOrDosen, siakadController.searchMataKuliah);

// Queue Management (mirror pola AI queue di routes/grading.js)
router.get('/queue/status', verifyToken, (req, res) => {
    try {
        const status = siakadQueueService.getQueueStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/queue/clear', verifyToken, isAdmin, (req, res) => {
    try {
        const result = siakadQueueService.clearQueue();
        res.json({ success: true, message: `Queue cleared. ${result.cleared} jobs removed.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
