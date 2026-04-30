const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. APPROVE: Buka Gembok Akun
exports.approveUser = async (req, res) => {
    try {
        await prisma.users.update({
            where: { id: parseInt(req.params.id) },
            data: { role: req.body.role, status_aktif: true }
        });
        res.status(200).json({ message: "Akun berhasil diaktifkan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyetujui akun." }); }
};

// 2. GET PENDING: Antrean Pendaftar Baru
exports.getPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await prisma.users.findMany({
            where: { status_aktif: false }, orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ data: pendingUsers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data antrean." }); }
};

// 3. GET ACTIVE: Semua Pengguna Aktif
exports.getActiveUsers = async (req, res) => {
    try {
        const activeUsers = await prisma.users.findMany({
            where: { status_aktif: true }, orderBy: { role: 'asc' }
        });
        res.status(200).json({ data: activeUsers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data pengguna." }); }
};

// 4. DELETE: Hapus Pengguna Permanen
exports.deleteUser = async (req, res) => {
    try {
        await prisma.users.delete({ where: { id: parseInt(req.params.id) } });
        res.status(200).json({ message: "Akun berhasil dihapus permanen!" });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus akun." }); }
};
