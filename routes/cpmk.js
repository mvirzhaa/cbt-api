const express = require('express');
const router = express.Router();
const cpmkController = require('../controllers/cpmkController');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/cpmk
// Tidak ada create/update manual di sini dengan sengaja — satu-satunya cara
// bikin cpmk/sub_cpmk lokal adalah lewat resolveCpmkFromSiakad (lihat
// routes/siakad.js), yang meng-copy kode/deskripsi/external_id langsung dari
// SIAKAD. Menghapus (unlink) tetap boleh, kalau dosen salah pilih.
router.get('/', verifyToken, isDosenOrSuperAdmin, cpmkController.getCpmk);
router.delete('/sub-cpmk/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.deleteSubCpmk);
router.delete('/:id', verifyToken, isDosenOrSuperAdmin, cpmkController.deleteCpmk);

module.exports = router;
