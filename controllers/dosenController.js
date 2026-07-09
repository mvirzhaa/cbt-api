const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt } = require('../utils/helpers');

// ============================================================
// GET /api/dosen/attempts/:exam_id
// Daftar semua attempt mahasiswa untuk satu ujian milik dosen
// ============================================================
exports.getAttemptsByExam = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const exam = await prisma.exams.findUnique({
            where: { id: examId },
            include: { mata_kuliah: true }
        });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Akses Ditolak! Ujian ini bukan milik Anda." });
        }

        const attempts = await prisma.exam_attempts.findMany({
            where: { exam_id: examId },
            include: { users: { select: { nama: true, nim: true } } },
            orderBy: { submitted_at: 'asc' }
        });

        const data = attempts.map(a => ({
            attempt_id: a.id,
            user_id: a.user_id,
            nama_mahasiswa: a.users.nama,
            nim: a.users.nim || '-',
            skor_pilgan_100: parseFloat(a.skor_pilgan_100 || 0),
            skor_esai_100: parseFloat(a.skor_esai_100 || 0),
            skor_file_100: parseFloat(a.skor_file_100 || 0),
            final_score: a.final_score !== null ? parseFloat(a.final_score) : null,
            status: a.status,
            submitted_at: a.submitted_at,
            verified_at: a.verified_at,
            siakad_sync_status: a.siakad_sync_status,
            siakad_synced_at: a.siakad_synced_at,
            siakad_error: a.siakad_error
        }));

        res.status(200).json({
            exam_info: {
                id: exam.id,
                nama_ujian: exam.nama_ujian,
                bobot_pilgan: exam.bobot_pilgan,
                bobot_esai: exam.bobot_esai,
                bobot_upload: exam.bobot_upload,
                siakad_kelas_kuliah_id: exam.siakad_kelas_kuliah_id,
                siakad_periode_akademik_id: exam.siakad_periode_akademik_id
            },
            data
        });
    } catch (error) {
        console.error("❌ ERROR GET ATTEMPTS:", error);
        res.status(500).json({ message: "Gagal mengambil data attempt ujian." });
    }
};

// ============================================================
// POST /api/dosen/verify-exam/:attempt_id
// Dosen memverifikasi & mempublish nilai dengan kalkulasi bobot
// ============================================================
exports.verifyExam = async (req, res) => {
    try {
        const attemptId = toPositiveInt(req.params.attempt_id);
        if (!attemptId) return res.status(400).json({ message: "ID attempt tidak valid." });

        const { skor_pilgan_100, skor_esai_100, skor_file_100 } = req.body;

        // Ambil data attempt beserta konfigurasi ujian
        const attempt = await prisma.exam_attempts.findUnique({
            where: { id: attemptId },
            include: { exams: true }
        });
        if (!attempt) return res.status(404).json({ message: "Data attempt tidak ditemukan." });
        if (attempt.exams.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Anda tidak berhak memverifikasi attempt ini." });
        }

        // Gunakan nilai dari payload dosen jika ada, fallback ke nilai AI yang tersimpan
        const nilaiPilgan = Number.isFinite(parseFloat(skor_pilgan_100))
            ? Math.min(100, Math.max(0, parseFloat(skor_pilgan_100)))
            : parseFloat(attempt.skor_pilgan_100 || 0);

        const nilaiEsai = Number.isFinite(parseFloat(skor_esai_100))
            ? Math.min(100, Math.max(0, parseFloat(skor_esai_100)))
            : parseFloat(attempt.skor_esai_100 || 0);

        const nilaiFile = Number.isFinite(parseFloat(skor_file_100))
            ? Math.min(100, Math.max(0, parseFloat(skor_file_100)))
            : parseFloat(attempt.skor_file_100 || 0);

        const { bobot_pilgan, bobot_esai, bobot_upload } = attempt.exams;

        // 📐 Rumus Kalkulasi Bobot (dari revisi_sistem.md)
        const final_score =
            nilaiPilgan * (bobot_pilgan / 100) +
            nilaiEsai   * (bobot_esai   / 100) +
            nilaiFile   * (bobot_upload / 100);

        const finalRounded = Math.round(final_score * 100) / 100;

        await prisma.exam_attempts.update({
            where: { id: attemptId },
            data: {
                skor_pilgan_100: nilaiPilgan,
                skor_esai_100:   nilaiEsai,
                skor_file_100:   nilaiFile,
                final_score:     finalRounded,
                status:          'SELESAI',
                verified_at:     new Date(),
                verified_by:     req.user.id
            }
        });

        res.status(200).json({
            message: "✅ Nilai berhasil diverifikasi dan dipublikasikan ke mahasiswa!",
            final_score: finalRounded,
            breakdown: {
                pilgan:  `${nilaiPilgan} × ${bobot_pilgan}% = ${(nilaiPilgan * bobot_pilgan / 100).toFixed(2)}`,
                esai:    `${nilaiEsai}   × ${bobot_esai}%   = ${(nilaiEsai   * bobot_esai   / 100).toFixed(2)}`,
                file:    `${nilaiFile}   × ${bobot_upload}% = ${(nilaiFile   * bobot_upload / 100).toFixed(2)}`
            }
        });
    } catch (error) {
        console.error("❌ ERROR VERIFY EXAM:", error);
        res.status(500).json({ message: "Gagal memverifikasi nilai." });
    }
};
