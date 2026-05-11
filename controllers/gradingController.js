const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt } = require('../utils/helpers');
const gradingService = require('../services/gradingService'); // 🌟 IMPORT MESIN PENILAI

exports.getMatakuliahScores = async (req, res) => {
    try {
        // 1. Tarik referensi ujian yang dimiliki dosen
        const exams = await prisma.exams.findMany({
            where: { kode_mk: req.params.id, kode_dosen: req.user.id.toString() }
        });

        if (exams.length === 0) return res.status(200).json({ data: [] }); 

        const examIds = exams.map(e => e.id);

        // 2. Tarik SEMUA jawaban mahasiswa beserta relasi data untuk kalkulasi bobot
        const responses = await prisma.student_responses.findMany({
            where: { exam_id: { in: examIds } },
            include: { 
                users: { select: { nama: true } }, 
                exams: true, // Butuh grading_type & bobot persentase
                questions: true // Butuh tipe_soal & bobot_nilai per soal
            }
        });

        // 3. Kelompokkan data per Mahasiswa & Ujian
        const groupedData = {};
        responses.forEach(r => {
            const key = `${r.user_id}-${r.exam_id}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    nama_mahasiswa: r.users?.nama || 'Anonim',
                    examConfig: r.exams,
                    responses: [],
                    questions: []
                };
            }
            groupedData[key].responses.push(r);
            // Hindari duplikasi referensi soal
            if (!groupedData[key].questions.find(q => q.id === r.questions.id)) {
                groupedData[key].questions.push(r.questions);
            }
        });

        // 4. Kalkulasi Menggunakan Grading Service
        const finalScores = [];
        for (const key in groupedData) {
            const data = groupedData[key];
            
            // 🤖 Panggil Otak AI/Kalkulator Kita
            const gradingResult = gradingService.calculateFinalScore(
                data.responses,
                data.questions,
                data.examConfig
            );

            finalScores.push({
                nama_mahasiswa: data.nama_mahasiswa,
                nama_ujian: data.examConfig.nama_ujian,
                total_skor: gradingResult.totalScore, // Skor akurat sesuai rumus (Mutlak/Persentase)
                rincian: gradingResult.breakdown, // Bawa rincian Pilgan/Esai/Upload ke Frontend Web
                status: gradingResult.isAllGraded ? 'Selesai' : 'Menunggu Koreksi',
                grading_type: data.examConfig.grading_type
            });
        }

        res.status(200).json({ data: finalScores });
    } catch (error) { 
        console.error("❌ ERROR GET MATAKULIAH SCORES:", error);
        res.status(500).json({ message: "Gagal tarik rekap nilai" }); 
    }
};

exports.getAnswersToGrade = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });
        
        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak!" });
        }

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: examId, status_penilaian: 'menunggu' },
            include: { 
                users: { select: { nama: true } }, 
                questions: { select: { isi_soal: true, tipe_soal: true } } 
            }
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

        if (!response) return res.status(404).json({ message: "Jawaban tidak ditemukan." });
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