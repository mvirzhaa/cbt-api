const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt } = require('../utils/helpers');
const gradingService = require('../services/gradingService');

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

        // 🔍 Transparansi: hitung estimasi nilai akhir & kelengkapan koreksi SEBELUM diverifikasi,
        // supaya dosen tidak perlu klik "Verifikasi" dulu baru lihat angkanya.
        const allQuestions = await prisma.questions.findMany({ where: { exam_id: examId } });
        const allResponses = await prisma.student_responses.findMany({ where: { exam_id: examId } });
        const responsesByUser = {};
        allResponses.forEach(r => {
            if (!responsesByUser[r.user_id]) responsesByUser[r.user_id] = [];
            responsesByUser[r.user_id].push(r);
        });

        const data = attempts.map(a => {
            const userResponses = responsesByUser[a.user_id] || [];
            const isAllGraded = userResponses.length > 0 && userResponses.every(r => r.status_penilaian !== 'menunggu');

            let previewFinalScore = null;
            if (exam.grading_type === 'PER_SOAL') {
                const gradingResult = gradingService.calculateFinalScore(userResponses, allQuestions, { grading_type: 'PER_SOAL' });
                previewFinalScore = gradingResult.totalScore;
            }

            return {
                attempt_id: a.id,
                user_id: a.user_id,
                nama_mahasiswa: a.users.nama,
                nim: a.users.nim || '-',
                skor_pilgan_100: parseFloat(a.skor_pilgan_100 || 0),
                skor_esai_100: parseFloat(a.skor_esai_100 || 0),
                skor_file_100: parseFloat(a.skor_file_100 || 0),
                final_score: a.final_score !== null ? parseFloat(a.final_score) : null,
                preview_final_score: previewFinalScore,
                is_all_graded: isAllGraded,
                status: a.status,
                submitted_at: a.submitted_at,
                verified_at: a.verified_at,
                siakad_sync_status: a.siakad_sync_status,
                siakad_synced_at: a.siakad_synced_at,
                siakad_error: a.siakad_error
            };
        });

        const totalBobotSoal = allQuestions.reduce((sum, q) => sum + (q.bobot_nilai ? parseFloat(q.bobot_nilai) : 0), 0);

        res.status(200).json({
            exam_info: {
                id: exam.id,
                kode_mk: exam.kode_mk,
                nama_ujian: exam.nama_ujian,
                grading_type: exam.grading_type || 'PER_KATEGORI',
                bobot_pilgan: exam.bobot_pilgan,
                bobot_esai: exam.bobot_esai,
                bobot_upload: exam.bobot_upload,
                total_bobot_soal: totalBobotSoal,
                siakad_kelas_kuliah_id: exam.siakad_kelas_kuliah_id,
                siakad_periode_akademik_id: exam.siakad_periode_akademik_id,
                siakad_rencana_evaluasi_id: exam.siakad_rencana_evaluasi_id
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

        if (attempt.exams.grading_type === 'PER_SOAL') {
            // Mode PER_SOAL: nilai akhir = jumlah langsung skor semua soal (bobot_nilai per soal),
            // bukan persentase kategori (bobot_pilgan/esai/upload diabaikan).
            const allQuestions = await prisma.questions.findMany({ where: { exam_id: attempt.exam_id } });
            const totalBobotSoal = allQuestions.reduce((sum, q) => sum + (q.bobot_nilai ? parseFloat(q.bobot_nilai) : 0), 0);
            if (Math.round(totalBobotSoal * 100) / 100 !== 100) {
                return res.status(400).json({
                    message: `Total bobot semua soal di ujian ini harus 100 untuk mode Per Soal (saat ini ${totalBobotSoal}). Perbaiki bobot_nilai tiap soal dulu di menu soal.`
                });
            }

            const responses = await prisma.student_responses.findMany({
                where: { user_id: attempt.user_id, exam_id: attempt.exam_id }
            });

            const gradingResult = gradingService.calculateFinalScore(responses, allQuestions, { grading_type: 'PER_SOAL' });
            const { breakdown } = gradingResult;

            const pilganMax = breakdown.TIPE_1.max + breakdown.TIPE_2.max;
            const pilganObtained = breakdown.TIPE_1.obtained + breakdown.TIPE_2.obtained;
            const nilaiPilgan100 = pilganMax > 0 ? Math.round((pilganObtained / pilganMax) * 10000) / 100 : 0;
            const nilaiEsai100 = breakdown.TIPE_3.max > 0 ? Math.round((breakdown.TIPE_3.obtained / breakdown.TIPE_3.max) * 10000) / 100 : 0;
            const nilaiFile100 = breakdown.TIPE_4.max > 0 ? Math.round((breakdown.TIPE_4.obtained / breakdown.TIPE_4.max) * 10000) / 100 : 0;

            await prisma.exam_attempts.update({
                where: { id: attemptId },
                data: {
                    skor_pilgan_100: nilaiPilgan100,
                    skor_esai_100:   nilaiEsai100,
                    skor_file_100:   nilaiFile100,
                    final_score:     gradingResult.totalScore,
                    status:          'SELESAI',
                    verified_at:     new Date(),
                    verified_by:     req.user.id
                }
            });

            return res.status(200).json({
                message: "✅ Nilai berhasil diverifikasi dan dipublikasikan ke mahasiswa!",
                final_score: gradingResult.totalScore,
                breakdown: {
                    pilgan: `${breakdown.TIPE_1.obtained + breakdown.TIPE_2.obtained} / ${pilganMax}`,
                    esai:   `${breakdown.TIPE_3.obtained} / ${breakdown.TIPE_3.max}`,
                    file:   `${breakdown.TIPE_4.obtained} / ${breakdown.TIPE_4.max}`
                }
            });
        }

        // Mode PER_KATEGORI (default): Gunakan nilai dari payload dosen jika ada, fallback ke nilai AI yang tersimpan
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
