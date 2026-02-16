const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Tambah Mata Kuliah (Hanya Admin)
exports.createMataKuliah = async (req, res) => {
    try {
        const { kode_mk, nama_mk } = req.body;

        // Cek apakah kode_mk sudah ada
        const existingMk = await prisma.mata_kuliah.findUnique({ where: { kode_mk } });
        if (existingMk) {
            return res.status(400).json({ message: "Kode Mata Kuliah sudah terdaftar!" });
        }

        const newMk = await prisma.mata_kuliah.create({
            data: { kode_mk, nama_mk }
        });

        res.status(201).json({ message: "Mata Kuliah berhasil ditambahkan", data: newMk });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};

// 2. Lihat Semua Mata Kuliah (Bisa diakses Dosen & Mahasiswa nantinya)
exports.getAllMataKuliah = async (req, res) => {
    try {
        const mkList = await prisma.mata_kuliah.findMany();
        res.json({ data: mkList });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};