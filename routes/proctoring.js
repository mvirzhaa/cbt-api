const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, isDosenOrSuperAdmin } = require('../middlewares/authMiddleware');
const handleUpload = require('../middlewares/uploadErrorHandler');

const router = express.Router();
const prisma = new PrismaClient();

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
router.post('/report', verifyToken, handleUpload(upload.single('foto_bukti'), 'error'), async (req, res) => {
  try {
    const { exam_id, jenis_pelanggaran } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Foto bukti tidak dikirim oleh sistem!' });
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
// 📋 GET: LIHAT DAFTAR TERSANGKA (UNTUK DOSEN)
// ==========================================
router.get('/', verifyToken, isDosenOrSuperAdmin, async (req, res) => {
    try {
        const violations = await prisma.exam_violations.findMany({
            include: {
                users: { select: { nama: true, email: true } },
                exams: { select: { nama_ujian: true } } // <--- INI YANG BENAR
            },
            orderBy: { waktu_kejadian: 'desc' }
        });
        res.status(200).json({ data: violations });
    } catch (error) {
        console.error("🚨 Error Get Violations:", error);
        res.status(500).json({ error: 'Gagal menarik data pelanggaran.' });
    }
});

module.exports = router;