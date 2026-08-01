const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');

// ==========================================
// 🎯 CPMK
// ==========================================

exports.getCpmk = async (req, res) => {
    try {
        const kodeMk = req.query.kode_mk;
        if (!isNonEmptyString(kodeMk)) return res.status(400).json({ message: "kode_mk wajib diisi." });

        const data = await prisma.cpmk.findMany({
            where: { kode_mk: kodeMk },
            include: { sub_cpmk: { orderBy: { id: 'asc' } } },
            orderBy: { id: 'asc' }
        });
        res.status(200).json({ data });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data CPMK." }); }
};

exports.createCpmk = async (req, res) => {
    try {
        const { kode_mk, kode_cpmk, deskripsi, external_id } = req.body;
        if (!isNonEmptyString(kode_mk) || !isNonEmptyString(kode_cpmk) || !isNonEmptyString(deskripsi)) {
            return res.status(400).json({ message: "kode_mk, kode_cpmk, dan deskripsi wajib diisi." });
        }

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        const newCpmk = await prisma.cpmk.create({ data: { kode_mk, kode_cpmk, deskripsi, external_id: isNonEmptyString(external_id) ? external_id : null } });
        res.status(201).json({ message: "CPMK berhasil dibuat!", data: newCpmk });
    } catch (error) {
        if (error.code === 'P2002') {
            const isExternalIdConflict = error.meta?.target?.includes?.('external_id');
            return res.status(409).json({ message: isExternalIdConflict ? "external_id ini sudah dipakai CPMK lain." : "Kode CPMK ini sudah terdaftar untuk mata kuliah tersebut." });
        }
        res.status(500).json({ message: "Gagal menyimpan CPMK." });
    }
};

exports.updateCpmk = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID CPMK tidak valid." });

        const { kode_cpmk, deskripsi, external_id } = req.body;
        const existing = await prisma.cpmk.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "CPMK tidak ditemukan." });

        const updated = await prisma.cpmk.update({
            where: { id },
            data: {
                kode_cpmk: isNonEmptyString(kode_cpmk) ? kode_cpmk : existing.kode_cpmk,
                deskripsi: isNonEmptyString(deskripsi) ? deskripsi : existing.deskripsi,
                external_id: external_id !== undefined ? (isNonEmptyString(external_id) ? external_id : null) : existing.external_id
            }
        });
        res.status(200).json({ message: "CPMK berhasil diperbarui.", data: updated });
    } catch (error) {
        if (error.code === 'P2002') {
            const isExternalIdConflict = error.meta?.target?.includes?.('external_id');
            return res.status(409).json({ message: isExternalIdConflict ? "external_id ini sudah dipakai CPMK lain." : "Kode CPMK ini sudah terdaftar untuk mata kuliah tersebut." });
        }
        res.status(500).json({ message: "Gagal memperbarui CPMK." });
    }
};

exports.deleteCpmk = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID CPMK tidak valid." });

        await prisma.cpmk.delete({ where: { id } });
        res.status(200).json({ message: "CPMK berhasil dihapus." });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus CPMK." }); }
};

// ==========================================
// 🎯 SUB-CPMK
// ==========================================

exports.createSubCpmk = async (req, res) => {
    try {
        const cpmkId = toPositiveInt(req.params.cpmk_id);
        if (!cpmkId) return res.status(400).json({ message: "ID CPMK tidak valid." });

        const { kode_sub_cpmk, deskripsi, external_id } = req.body;
        if (!isNonEmptyString(kode_sub_cpmk) || !isNonEmptyString(deskripsi)) {
            return res.status(400).json({ message: "kode_sub_cpmk dan deskripsi wajib diisi." });
        }

        const cpmk = await prisma.cpmk.findUnique({ where: { id: cpmkId } });
        if (!cpmk) return res.status(404).json({ message: "CPMK tidak ditemukan." });

        const newSubCpmk = await prisma.sub_cpmk.create({ data: { cpmk_id: cpmkId, kode_sub_cpmk, deskripsi, external_id: isNonEmptyString(external_id) ? external_id : null } });
        res.status(201).json({ message: "Sub-CPMK berhasil dibuat!", data: newSubCpmk });
    } catch (error) {
        if (error.code === 'P2002') {
            const isExternalIdConflict = error.meta?.target?.includes?.('external_id');
            return res.status(409).json({ message: isExternalIdConflict ? "external_id ini sudah dipakai Sub-CPMK lain." : "Kode Sub-CPMK ini sudah terdaftar untuk CPMK tersebut." });
        }
        res.status(500).json({ message: "Gagal menyimpan Sub-CPMK." });
    }
};

exports.updateSubCpmk = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID Sub-CPMK tidak valid." });

        const { kode_sub_cpmk, deskripsi, external_id } = req.body;
        const existing = await prisma.sub_cpmk.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Sub-CPMK tidak ditemukan." });

        const updated = await prisma.sub_cpmk.update({
            where: { id },
            data: {
                kode_sub_cpmk: isNonEmptyString(kode_sub_cpmk) ? kode_sub_cpmk : existing.kode_sub_cpmk,
                deskripsi: isNonEmptyString(deskripsi) ? deskripsi : existing.deskripsi,
                external_id: external_id !== undefined ? (isNonEmptyString(external_id) ? external_id : null) : existing.external_id
            }
        });
        res.status(200).json({ message: "Sub-CPMK berhasil diperbarui.", data: updated });
    } catch (error) {
        if (error.code === 'P2002') {
            const isExternalIdConflict = error.meta?.target?.includes?.('external_id');
            return res.status(409).json({ message: isExternalIdConflict ? "external_id ini sudah dipakai Sub-CPMK lain." : "Kode Sub-CPMK ini sudah terdaftar untuk CPMK tersebut." });
        }
        res.status(500).json({ message: "Gagal memperbarui Sub-CPMK." });
    }
};

exports.deleteSubCpmk = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID Sub-CPMK tidak valid." });

        await prisma.sub_cpmk.delete({ where: { id } });
        res.status(200).json({ message: "Sub-CPMK berhasil dihapus." });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus Sub-CPMK." }); }
};
