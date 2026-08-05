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

// Import banyak mata kuliah SIAKAD sekaligus (dari hasil GET /api/siakad/matakuliah
// di picker frontend). Upsert by kode_mk: baru -> create, sudah ada tapi belum
// punya siakad_id -> disambungkan, sudah ada & sudah punya siakad_id -> dilewati
// (tidak menimpa pemetaan manual yang sudah benar, mis. kasus dua kode SIAKAD
// dengan nama sama tapi cuma satu yang punya data OBE).
exports.bulkImportFromSiakad = async (req, res) => {
    try {
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (items.length === 0) {
            return res.status(400).json({ message: "items wajib diisi (array mata kuliah SIAKAD yang mau diimpor)." });
        }

        const created = [];
        const linked = [];
        const skipped = [];
        const failed = [];

        for (const item of items) {
            const kodeMk = (item.kode_mk || '').trim().toUpperCase();
            const namaMk = (item.nama_mk || '').trim();
            const siakadId = (item.siakad_id || '').trim();

            if (!kodeMk || !namaMk || !siakadId) {
                failed.push({ kode_mk: kodeMk || null, message: "kode_mk/nama_mk/siakad_id tidak lengkap." });
                continue;
            }

            try {
                const existing = await prisma.mata_kuliah.findUnique({ where: { kode_mk: kodeMk } });
                if (!existing) {
                    await prisma.mata_kuliah.create({ data: { kode_mk: kodeMk, nama_mk: namaMk, siakad_id: siakadId } });
                    created.push(kodeMk);
                } else if (!existing.siakad_id) {
                    await prisma.mata_kuliah.update({ where: { kode_mk: kodeMk }, data: { siakad_id: siakadId } });
                    linked.push(kodeMk);
                } else {
                    skipped.push({ kode_mk: kodeMk, reason: existing.siakad_id === siakadId ? "Sudah terhubung." : "Sudah dipetakan ke ID SIAKAD lain, tidak ditimpa." });
                }
            } catch (error) {
                failed.push({ kode_mk: kodeMk, message: error.code === 'P2002' ? "ID SIAKAD ini sudah dipakai mata kuliah lokal lain." : "Gagal impor." });
            }
        }

        res.status(200).json({
            message: `Impor selesai: ${created.length} baru, ${linked.length} tersambung, ${skipped.length} dilewati, ${failed.length} gagal.`,
            created,
            linked,
            skipped,
            failed
        });
    } catch (error) {
        console.error("❌ ERROR BULK IMPORT MATAKULIAH SIAKAD:", error);
        res.status(500).json({ message: "Gagal impor mata kuliah dari SIAKAD." });
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
