const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

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

const upload = multer({ storage: storage });

// ==========================================
// 📸 POST: TERIMA BARANG BUKTI DARI FRONTEND
// ==========================================
router.post('/report', upload.single('foto_bukti'), async (req, res) => {
  try {
    const { user_id, exam_id, jenis_pelanggaran } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Foto bukti tidak dikirim oleh sistem!' });
    }

    // Path foto untuk disimpan di database
    const fotoPath = '/uploads/violations/' + req.file.filename;

    // Simpan ke Tabel Pelanggaran
    const newViolation = await prisma.exam_violations.create({
      data: {
        user_id: parseInt(user_id),
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
router.get('/', async (req, res) => {
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