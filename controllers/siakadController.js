const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');
const siakadQueueService = require('../services/siakadQueueService');
const siakadClient = require('../services/siakadClient');

const buildJobFromAttempt = (attempt) => ({
    attempt_id: attempt.id,
    nim: attempt.users.nim,
    kode_mk: attempt.exams.kode_mk,
    siakad_kelas_kuliah_id: attempt.exams.siakad_kelas_kuliah_id,
    siakad_periode_akademik_id: attempt.exams.siakad_periode_akademik_id,
    komponen_nilai: {
        skor_pilgan_100: parseFloat(attempt.skor_pilgan_100 || 0),
        skor_esai_100: parseFloat(attempt.skor_esai_100 || 0),
        skor_file_100: parseFloat(attempt.skor_file_100 || 0),
        final_score: attempt.final_score !== null ? parseFloat(attempt.final_score) : null
    }
});

// ============================================================
// PUT /api/siakad/exams/:exam_id/target
// Set target kelas & periode SIAKAD untuk satu ujian (sekali per exam)
// ============================================================
exports.setExamSiakadTarget = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { siakad_kelas_kuliah_id, siakad_periode_akademik_id } = req.body;
        if (!isNonEmptyString(siakad_kelas_kuliah_id) || !isNonEmptyString(siakad_periode_akademik_id)) {
            return res.status(400).json({ message: "siakad_kelas_kuliah_id dan siakad_periode_akademik_id wajib diisi." });
        }

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Akses Ditolak! Ujian ini bukan milik Anda." });
        }

        const updated = await prisma.exams.update({
            where: { id: examId },
            data: { siakad_kelas_kuliah_id, siakad_periode_akademik_id }
        });

        res.status(200).json({
            message: "Target SIAKAD berhasil disimpan.",
            data: {
                siakad_kelas_kuliah_id: updated.siakad_kelas_kuliah_id,
                siakad_periode_akademik_id: updated.siakad_periode_akademik_id
            }
        });
    } catch (error) {
        console.error("❌ ERROR SET SIAKAD TARGET:", error);
        res.status(500).json({ message: "Gagal menyimpan target SIAKAD." });
    }
};

// ============================================================
// POST /api/siakad/attempts/:attempt_id/push
// Push satu nilai mahasiswa ke SIAKAD (masuk queue)
// ============================================================
exports.pushAttempt = async (req, res) => {
    try {
        const attemptId = toPositiveInt(req.params.attempt_id);
        if (!attemptId) return res.status(400).json({ message: "ID attempt tidak valid." });

        const attempt = await prisma.exam_attempts.findUnique({
            where: { id: attemptId },
            include: { exams: true, users: { select: { nim: true } } }
        });
        if (!attempt) return res.status(404).json({ message: "Data attempt tidak ditemukan." });
        if (attempt.exams.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Anda tidak berhak push attempt ini." });
        }
        if (attempt.status !== 'SELESAI') {
            return res.status(400).json({ message: "Nilai belum diverifikasi. Verifikasi & Publish dulu sebelum push ke SIAKAD." });
        }
        if (!attempt.exams.siakad_kelas_kuliah_id || !attempt.exams.siakad_periode_akademik_id) {
            return res.status(400).json({ message: "Set target kelas SIAKAD untuk ujian ini terlebih dahulu." });
        }
        if (!attempt.users.nim) {
            return res.status(400).json({ message: "Mahasiswa ini belum memiliki NIM, tidak bisa disinkronkan ke SIAKAD." });
        }

        await prisma.exam_attempts.update({
            where: { id: attemptId },
            data: { siakad_sync_status: 'ANTRIAN', siakad_error: null }
        });

        siakadQueueService.addToQueue(buildJobFromAttempt(attempt));

        res.status(200).json({ message: "Nilai masuk antrian pengiriman ke SIAKAD." });
    } catch (error) {
        console.error("❌ ERROR PUSH ATTEMPT:", error);
        res.status(500).json({ message: "Gagal push nilai ke SIAKAD." });
    }
};

// ============================================================
// POST /api/siakad/exams/:exam_id/push
// Push semua attempt SELESAI pada satu ujian ke SIAKAD (bulk)
// ============================================================
exports.pushExamAttempts = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Akses Ditolak! Ujian ini bukan milik Anda." });
        }
        if (!exam.siakad_kelas_kuliah_id || !exam.siakad_periode_akademik_id) {
            return res.status(400).json({ message: "Set target kelas SIAKAD untuk ujian ini terlebih dahulu." });
        }

        const attempts = await prisma.exam_attempts.findMany({
            where: { exam_id: examId, status: 'SELESAI' },
            include: { exams: true, users: { select: { nim: true } } }
        });

        const eligible = attempts.filter(a => a.users.nim);
        const skippedNoNim = attempts.length - eligible.length;

        await prisma.exam_attempts.updateMany({
            where: { id: { in: eligible.map(a => a.id) } },
            data: { siakad_sync_status: 'ANTRIAN', siakad_error: null }
        });

        eligible.forEach(attempt => siakadQueueService.addToQueue(buildJobFromAttempt(attempt)));

        res.status(200).json({
            message: `${eligible.length} nilai masuk antrian pengiriman ke SIAKAD.${skippedNoNim > 0 ? ` ${skippedNoNim} dilewati karena mahasiswa belum punya NIM.` : ''}`,
            queued: eligible.length,
            skippedNoNim
        });
    } catch (error) {
        console.error("❌ ERROR PUSH EXAM ATTEMPTS:", error);
        res.status(500).json({ message: "Gagal push nilai ujian ke SIAKAD." });
    }
};

// ============================================================
// GET /api/siakad/matakuliah
// Proxy pencarian mata kuliah dari SIAKAD (untuk picker di form matkul lokal)
// ============================================================
exports.searchMataKuliah = async (req, res) => {
    try {
        const page = toPositiveInt(req.query.page) || 1;
        const size = toPositiveInt(req.query.size) || 100;

        const result = await siakadClient.searchMataKuliah({ page, size });

        if (!result.success) {
            return res.status(502).json({ message: `Gagal mengambil data mata kuliah dari SIAKAD: ${result.message}` });
        }

        res.status(200).json({ data: result.data, pagination: result.pagination });
    } catch (error) {
        console.error("❌ ERROR SEARCH SIAKAD MATAKULIAH:", error);
        res.status(500).json({ message: "Gagal mengambil data mata kuliah dari SIAKAD." });
    }
};
