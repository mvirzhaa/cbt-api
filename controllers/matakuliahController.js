const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create Mata Kuliah
exports.createMatakuliah = async (req, res) => {
    try {
        const { kode_mk, nama_mk, dosen_id, siakad_id } = req.body;
        const newMk = await prisma.mata_kuliah.create({
            data: { kode_mk, nama_mk, dosen_id: dosen_id ? parseInt(dosen_id) : null, siakad_id: siakad_id || null }
        });
        res.status(201).json({ data: newMk });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Kode MK ini sudah terdaftar, atau mata kuliah SIAKAD ini sudah pernah diimpor sebelumnya." });
        }
        res.status(500).json({ message: "Gagal menyimpan mata kuliah" });
    }
};

// Get All Mata Kuliah
exports.getAllMatakuliah = async (req, res) => {
    try {
        const matkul = await prisma.mata_kuliah.findMany({ include: { users: { select: { nama: true } } } });
        res.status(200).json({ data: matkul });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data mata kuliah" }); }
};

// Update Mata Kuliah
exports.updateMatakuliah = async (req, res) => {
    try {
        const existing = await prisma.mata_kuliah.findUnique({ where: { kode_mk: req.params.kode_mk } });
        if (!existing) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        const updatedMk = await prisma.mata_kuliah.update({
            where: { kode_mk: req.params.kode_mk },
            data: {
                nama_mk: req.body.nama_mk !== undefined ? req.body.nama_mk : existing.nama_mk,
                dosen_id: req.body.dosen_id !== undefined ? (req.body.dosen_id ? parseInt(req.body.dosen_id) : null) : existing.dosen_id,
                siakad_id: req.body.siakad_id !== undefined ? (req.body.siakad_id || null) : existing.siakad_id
            }
        });
        res.status(200).json({ message: "Update berhasil!", data: updatedMk });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Mata kuliah SIAKAD ini sudah dipetakan ke mata kuliah lokal lain." });
        }
        res.status(500).json({ message: "Gagal mengupdate mata kuliah." });
    }
};

// Delete Mata Kuliah
exports.deleteMatakuliah = async (req, res) => {
    try {
        await prisma.mata_kuliah.delete({ where: { kode_mk: req.params.kode_mk } });
        res.status(200).json({ message: "Mata kuliah berhasil dihapus!" });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus! Pastikan tidak terikat dengan ujian." }); }
};
