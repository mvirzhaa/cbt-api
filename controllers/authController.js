const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

// 1. REGISTER (Akun baru mendaftar)
exports.register = async (req, res) => {
    try {
        const { nama, email, password } = req.body;

        // Cek apakah email sudah dipakai
        const existingUser = await prisma.users.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email sudah terdaftar!" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Buat user baru (otomatis status_aktif = false dan role = mahasiswa dari database)
        const newUser = await prisma.users.create({
            data: {
                nama,
                email,
                password: hashedPassword
            }
        });

        res.status(201).json({ 
            message: "Registrasi berhasil! Silakan tunggu Admin untuk mengaktifkan akun dan menentukan role Anda.",
            data: { id: newUser.id, nama: newUser.nama, email: newUser.email }
        });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};

// 2. LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.users.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "Akun tidak ditemukan!" });
        }

        // Realita Teknis: Cek apakah akun sudah di-ACC Admin
        if (!user.status_aktif) {
            return res.status(403).json({ message: "Akses ditolak! Akun Anda belum diaktifkan oleh Admin." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Password salah!" });
        }

        // Buat Token JWT untuk akses API selanjutnya
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '1d' } // Token berlaku 1 hari
        );

        res.json({ 
            message: "Login berhasil!", 
            token, 
            user: { id: user.id, nama: user.nama, role: user.role } 
        });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};

// 3. ADMIN APPROVAL (Khusus Admin menetapkan role & aktivasi)
exports.approveUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, status_aktif } = req.body; // Admin mengirimkan role dan status baru

        const updatedUser = await prisma.users.update({
            where: { id: parseInt(id) },
            data: { role, status_aktif }
        });

        res.json({ 
            message: "Status dan Role pengguna berhasil diperbarui!",
            data: { id: updatedUser.id, nama: updatedUser.nama, role: updatedUser.role, status: updatedUser.status_aktif }
        });

    } catch (error) {
        res.status(500).json({ message: "Gagal memperbarui pengguna", error: error.message });
    }
};
