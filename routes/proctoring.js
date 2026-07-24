const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { PrismaClient, exam_violations_jenis_pelanggaran } = require('@prisma/client');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');
const handleUpload = require('../middlewares/uploadErrorHandler');
const proctoringHeartbeatService = require('../services/proctoringHeartbeatService');

const router = express.Router();
const prisma = new PrismaClient();

const JENIS_PELANGGARAN_VALID = Object.values(exam_violations_jenis_pelanggaran);

// 🚦 Batasi laporan pelanggaran per mahasiswa (cooldown FE seharusnya 15 detik,
// limiter ini cuma jaring pengaman kalau FE dimodifikasi/dilewati)
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user-${req.user.id}` : ipKeyGenerator(req.ip)),
  handler: (req, res) => res.status(429).json({ error: 'Terlalu banyak laporan pelanggaran dalam waktu singkat. Coba lagi sebentar.' })
});

// 📂 Konfigurasi Brankas Foto Bukti
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/violations');
    // Jika folder belum ada, otomatis buatkan!
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Penamaan file: violation-WaktuKejadian-Random.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'violation-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 🔒 Barang bukti selalu berupa screenshot JPEG dari canvas — batasi ketat (sebelumnya tanpa batas sama sekali)
const fileFilter = (req, file, cb) => {
  const extRegex = /jpeg|jpg|png/;
  const mimeRegex = /jpeg|jpg|png/;

  const extname = extRegex.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimeRegex.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Format file ditolak! Foto bukti harus JPG atau PNG.'), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // Screenshot webcam kualitas 60%, 2MB lebih dari cukup
});

// ==========================================
// 📸 POST: TERIMA BARANG BUKTI DARI FRONTEND
// ==========================================
router.post('/report', verifyToken, reportLimiter, handleUpload(upload.single('foto_bukti'), 'error'), async (req, res) => {
  try {
    const { exam_id, jenis_pelanggaran } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Foto bukti tidak dikirim oleh sistem!' });
    }

    if (!JENIS_PELANGGARAN_VALID.includes(jenis_pelanggaran)) {
      return res.status(400).json({ error: `jenis_pelanggaran tidak valid. Nilai yang diizinkan: ${JENIS_PELANGGARAN_VALID.join(', ')}` });
    }

    // Path foto untuk disimpan di database
    const fotoPath = '/uploads/violations/' + req.file.filename;

    // 🔒 user_id diambil dari token JWT (req.user), BUKAN dari body — mencegah pelaporan atas nama orang lain
    const newViolation = await prisma.exam_violations.create({
      data: {
        user_id: req.user.id,
        exam_id: parseInt(exam_id),
        jenis_pelanggaran: jenis_pelanggaran,
        foto_bukti: fotoPath,
      }
    });

    res.status(201).json({
        message: 'Tertangkap basah! Barang bukti berhasil diamankan.',
        data: newViolation
    });
  } catch (error) {
    console.error("🚨 Error Save Violation:", error);
    res.status(500).json({ error: 'Gagal menyimpan data pelanggaran ke server.' });
  }
});

// ==========================================
// 💓 POST: HEARTBEAT PENGAWAS AI (DIPANGGIL OTOMATIS OLEH FE SELAMA UJIAN)
// ==========================================
router.post('/heartbeat', verifyToken, (req, res) => {
    const examId = parseInt(req.body.exam_id);
    if (!examId) {
        return res.status(400).json({ error: 'exam_id wajib diisi.' });
    }

    proctoringHeartbeatService.touch(req.user.id, examId);
    res.status(200).json({ ok: true });
});

// ==========================================
// 📋 GET: LIHAT DAFTAR TERSANGKA (UNTUK DOSEN)
// ==========================================
router.get('/', verifyToken, isDosenOrSuperAdmin, async (req, res) => {
    try {
        const { exam_id, status } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));

        const where = {};
        if (exam_id) where.exam_id = parseInt(exam_id);
        if (status) where.status = status;

        const [violations, total] = await Promise.all([
            prisma.exam_violations.findMany({
                where,
                include: {
                    users: { select: { nama: true, email: true } },
                    exams: { select: { nama_ujian: true } }, // <--- INI YANG BENAR
                    peninjau: { select: { nama: true } }
                },
                orderBy: { waktu_kejadian: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.exam_violations.count({ where })
        ]);

        res.status(200).json({
            data: violations,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (error) {
        console.error("🚨 Error Get Violations:", error);
        res.status(500).json({ error: 'Gagal menarik data pelanggaran.' });
    }
});

// ==========================================
// ✅ PATCH: TANDAI PELANGGARAN SUDAH DITINJAU (UNTUK DOSEN)
// ==========================================
router.patch('/:id/review', verifyToken, isDosenOrSuperAdmin, async (req, res) => {
    try {
        const updated = await prisma.exam_violations.update({
            where: { id: parseInt(req.params.id) },
            data: {
                status: 'DITINJAU',
                ditinjau_at: new Date(),
                ditinjau_oleh: req.user.id
            }
        });
        res.status(200).json({ message: 'Pelanggaran ditandai sudah ditinjau.', data: updated });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Data pelanggaran tidak ditemukan.' });
        }
        console.error("🚨 Error Review Violation:", error);
        res.status(500).json({ error: 'Gagal menandai pelanggaran sebagai ditinjau.' });
    }
});

module.exports = router;