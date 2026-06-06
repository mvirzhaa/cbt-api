const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================================
// GET /api/student/exam-terms/:examId
// Mahasiswa mengambil syarat & ketentuan ujian sebelum mulai
// ============================================================
exports.getTermsForStudent = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);
        if (!examId || isNaN(examId)) {
            return res.status(400).json({ success: false, message: 'ID ujian tidak valid.' });
        }

        const terms = await prisma.exam_terms.findMany({
            where: { exam_id: examId },
            orderBy: { urutan: 'asc' },
            select: { id: true, isi_syarat: true, urutan: true }
        });

        // Jika dosen belum mengatur S&K, kembalikan daftar default
        const defaultTerms = [
            { id: 0, isi_syarat: 'Peserta wajib mengerjakan ujian secara mandiri dan jujur.', urutan: 1 },
            { id: 0, isi_syarat: 'Dilarang membuka catatan, buku, atau sumber lain selama ujian berlangsung.', urutan: 2 },
            { id: 0, isi_syarat: 'Dilarang berdiskusi atau bekerja sama dengan peserta lain.', urutan: 3 },
            { id: 0, isi_syarat: 'Jawaban tidak dapat diubah setelah ujian dikumpulkan.', urutan: 4 },
            { id: 0, isi_syarat: 'Pelanggaran akademik dapat berakibat pada pembatalan nilai ujian.', urutan: 5 },
        ];

        return res.status(200).json({
            success: true,
            data: {
                exam_id: examId,
                terms: terms.length > 0 ? terms : defaultTerms,
                is_custom: terms.length > 0
            }
        });
    } catch (error) {
        console.error('❌ ERROR GET TERMS (Student):', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil syarat & ketentuan ujian.' });
    }
};

// ============================================================
// GET /api/dosen/exam-terms/:examId
// Dosen melihat syarat & ketentuan yang sudah diatur
// ============================================================
exports.getTermsForDosen = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);
        if (!examId || isNaN(examId)) {
            return res.status(400).json({ success: false, message: 'ID ujian tidak valid.' });
        }

        // Pastikan ujian ini milik dosen yang bersangkutan
        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Akses Ditolak! Ujian ini bukan milik Anda.' });
        }

        const terms = await prisma.exam_terms.findMany({
            where: { exam_id: examId },
            orderBy: { urutan: 'asc' }
        });

        return res.status(200).json({ success: true, data: { exam_id: examId, terms } });
    } catch (error) {
        console.error('❌ ERROR GET TERMS (Dosen):', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil syarat & ketentuan.' });
    }
};

// ============================================================
// POST /api/dosen/exam-terms/:examId
// Dosen menyimpan/update seluruh syarat & ketentuan untuk ujian
// Body: { terms: ["string1", "string2", ...] }
// ============================================================
exports.saveTermsForDosen = async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);
        if (!examId || isNaN(examId)) {
            return res.status(400).json({ success: false, message: 'ID ujian tidak valid.' });
        }

        const { terms } = req.body;
        if (!Array.isArray(terms)) {
            return res.status(400).json({ success: false, message: 'Field "terms" harus berupa array string.' });
        }

        // Pastikan ujian ini milik dosen yang bersangkutan
        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Akses Ditolak! Ujian ini bukan milik Anda.' });
        }

        // Filter string kosong dan batasi input
        const cleanTerms = terms
            .filter(t => typeof t === 'string' && t.trim().length > 0)
            .slice(0, 20); // Maksimal 20 syarat & ketentuan

        // Strategi: hapus semua yang lama, insert yang baru (replace all)
        await prisma.$transaction([
            prisma.exam_terms.deleteMany({ where: { exam_id: examId } }),
            prisma.exam_terms.createMany({
                data: cleanTerms.map((isi, index) => ({
                    exam_id: examId,
                    isi_syarat: isi.trim(),
                    urutan: index + 1
                }))
            })
        ]);

        return res.status(200).json({
            success: true,
            message: `✅ ${cleanTerms.length} syarat & ketentuan berhasil disimpan untuk ujian ini.`,
            data: { exam_id: examId, total: cleanTerms.length }
        });
    } catch (error) {
        console.error('❌ ERROR SAVE TERMS (Dosen):', error);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan syarat & ketentuan.' });
    }
};
