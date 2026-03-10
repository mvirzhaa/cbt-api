const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // <--- TAMBAHKAN INI
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// 1. Konfigurasi "Mesin Penerima" Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // File akan disimpan di folder ini
    cb(null, 'uploads/materi/'); 
  },
  filename: function (req, file, cb) {
    // Mengubah nama file agar unik (tidak tertimpa jika ada nama file yang sama)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 2. Endpoint API untuk Upload Materi (POST)
router.post('/upload', upload.single('file_materi'), async (req, res) => {
  try {
    const { kode_mk, dosen_id, judul, deskripsi } = req.body;
    
    // Cek apakah ada file yang terkirim
    if (!req.file) {
      return res.status(400).json({ error: 'File materi wajib diunggah!' });
    }

    // Membuat jalur file untuk disimpan ke Database
    const file_path = `/uploads/materi/${req.file.filename}`;

    // Simpan data ke Database via Prisma
    const materiBaru = await prisma.materi_kuliah.create({
      data: {
        kode_mk: kode_mk,
        dosen_id: parseInt(dosen_id),
        judul: judul,
        deskripsi: deskripsi || '',
        file_path: file_path,
      }
    });

    res.status(201).json({ 
      message: 'Materi berhasil diunggah ke ruang kelas!', 
      data: materiBaru 
    });

  } catch (error) {
    console.error("Error Upload Materi:", error);
    res.status(500).json({ error: 'Gagal mengunggah materi ke server.' });
  }
});

// ==========================================
// 📖 GET: AMBIL DAFTAR MATERI
// ==========================================
router.get('/', async (req, res) => {
  try {
    const daftarMateri = await prisma.materi_kuliah.findMany({
      include: { 
        mata_kuliah: { select: { nama_mk: true } },
        users: { select: { nama: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.status(200).json({ data: daftarMateri });
  } catch (error) {
    console.error("Error Get Materi:", error);
    res.status(500).json({ error: 'Gagal mengambil data materi.' });
  }
});

// ==========================================
// 🗑️ DELETE: HAPUS MATERI & FILE FISIKNYA
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // 1. Cari data materi di database
    const materi = await prisma.materi_kuliah.findUnique({ where: { id } });
    if (!materi) return res.status(404).json({ error: 'Materi tidak ditemukan' });

    // 2. Hapus file fisiknya dari folder uploads/materi
    // (Agar harddisk server tidak penuh dengan file sampah)
    const filePath = path.join(__dirname, '..', materi.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 3. Hapus catatannya dari database
    await prisma.materi_kuliah.delete({ where: { id } });
    
    res.status(200).json({ message: 'Materi beserta file fisiknya berhasil dihapus permanen!' });
  } catch (error) {
    console.error("Error Delete Materi:", error);
    res.status(500).json({ error: 'Gagal menghapus materi.' });
  }
});

module.exports = router;