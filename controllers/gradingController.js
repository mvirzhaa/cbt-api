const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt } = require('../utils/helpers');

exports.getMatakuliahScores = async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: { kode_mk: req.params.id, kode_dosen: req.user.id.toString() }, select: { id: true }
        });

        const examIds = exams.map(e => e.id);
        if (examIds.length === 0) return res.status(200).json({ data: [] }); 

        const responses = await prisma.student_responses.findMany({
            where: { exam_id: { in: examIds } },
            include: { users: { select: { nama: true } }, exams: { select: { nama_ujian: true } } }
        });

        const scoreMap = {};
        responses.forEach(r => {
            const key = `${r.user_id}-${r.exam_id}`;
            if (!scoreMap[key]) {
                scoreMap[key] = { nama_mahasiswa: r.users?.nama || 'Anonim', nama_ujian: r.exams?.nama_ujian || '-', total_skor: 0, status: 'Selesai' };
            }
            scoreMap[key].total_skor += parseFloat(r.skor || 0);
            if (r.status_penilaian === 'menunggu') scoreMap[key].status = 'Menunggu Koreksi';
        });

        res.status(200).json({ data: Object.values(scoreMap) });
    } catch (error) { res.status(500).json({ message: "Gagal tarik rekap" }); }
};

exports.getAnswersToGrade = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) {
            return res.status(400).json({ message: "ID ujian tidak valid." });
        }
        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) return res.status(403).json({ message: "Akses Ditolak!" });

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: examId, status_penilaian: 'menunggu' },
            include: { users: { select: { nama: true } }, questions: { select: { isi_soal: true, tipe_soal: true } } }
        });
        res.status(200).json({ data: answers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data jawaban." }); }
};

exports.submitScore = async (req, res) => {
    try {
        const responseId = toPositiveInt(req.params.response_id);
        const scoreValue = Number.parseFloat(req.body.skor);
        if (!responseId || !Number.isFinite(scoreValue) || scoreValue < 0) {
            return res.status(400).json({ message: "Input penilaian tidak valid." });
        }
        const response = await prisma.student_responses.findUnique({
            where: { id: responseId },
            include: { exams: true }
        });

        if (!response) {
            return res.status(404).json({ message: "Jawaban tidak ditemukan." });
        }
        if (response.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menilai jawaban ini." });
        }

        await prisma.student_responses.update({
            where: { id: responseId },
            data: { skor: scoreValue, status_penilaian: 'selesai' }
        });
        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan nilai." }); }
};