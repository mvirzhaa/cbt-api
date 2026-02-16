const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto'); // Bawaan Node.js untuk generate string acak
const prisma = new PrismaClient();

// 1. Buat Ujian Baru (Khusus Dosen)
exports.createExam = async (req, res) => {
    try {
        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai } = req.body;

        // Validasi apakah mata kuliah ada
        const checkMk = await prisma.mata_kuliah.findUnique({ where: { kode_mk } });
        if (!checkMk) {
            return res.status(404).json({ message: "Mata Kuliah tidak ditemukan!" });
        }

        // Generate Token Ujian (6 Karakter Acak: Huruf & Angka)
        const token_ujian = crypto.randomBytes(3).toString('hex').toUpperCase();

        // req.user.id didapat dari JWT Token Dosen yang sedang login
        const kode_dosen = req.user.id.toString(); 

        const newExam = await prisma.exams.create({
            data: {
                kode_mk,
                kode_dosen,
                nama_ujian,
                token_ujian, // Token dimasukkan otomatis
                waktu_mulai: new Date(waktu_mulai),
                waktu_selesai: new Date(waktu_selesai)
            }
        });

        res.status(201).json({ 
            message: "Ujian berhasil dibuat! Bagikan token ini kepada mahasiswa.", 
            data: {
                id_ujian: newExam.id,
                nama_ujian: newExam.nama_ujian,
                TOKEN_UJIAN: newExam.token_ujian // Highlight token untuk dosen
            } 
        });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};