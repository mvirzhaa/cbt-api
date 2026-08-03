const express = require('express');
const router = express.Router();
const siakadController = require('../controllers/siakadController');
const { verifyToken, isDosenOrSuperAdmin, isAdmin } = require('../middlewares/authMiddleware');
const siakadQueueService = require('../services/siakadQueueService');

// Base URL: /api/siakad

router.put('/exams/:exam_id/target', verifyToken, isDosenOrSuperAdmin, siakadController.setExamSiakadTarget);
router.post('/attempts/:attempt_id/push', verifyToken, isDosenOrSuperAdmin, siakadController.pushAttempt);
router.post('/exams/:exam_id/push', verifyToken, isDosenOrSuperAdmin, siakadController.pushExamAttempts);

// Rencana Evaluasi & sinkronisasi CPMK (setup sebelum push nilai)
router.get('/rencana-evaluasi', verifyToken, isDosenOrSuperAdmin, siakadController.getRencanaEvaluasi);
router.post('/mata-kuliah/:kode_mk/sync-cpmk', verifyToken, isDosenOrSuperAdmin, siakadController.syncCpmkExternalIds);

// Pemetaan CPMK live (picker Sub-CPMK saat bikin soal) & auto-provision
router.get('/mata-kuliah/:kode_mk/pemetaan-cpmk', verifyToken, isDosenOrSuperAdmin, siakadController.getPemetaanCpmk);
router.post('/mata-kuliah/:kode_mk/resolve-cpmk', verifyToken, isDosenOrSuperAdmin, siakadController.resolveCpmkFromSiakad);

// Pull mata kuliah (untuk picker di form matkul lokal)
router.get('/matakuliah', verifyToken, isAdmin, siakadController.searchMataKuliah);

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
