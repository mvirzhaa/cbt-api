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

exports.deleteSubCpmk = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID Sub-CPMK tidak valid." });

        await prisma.sub_cpmk.delete({ where: { id } });
        res.status(200).json({ message: "Sub-CPMK berhasil dihapus." });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus Sub-CPMK." }); }
};
