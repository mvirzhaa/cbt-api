const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');

const ALLOWED_QUESTION_TYPES = new Set(['TIPE_1', 'TIPE_2', 'TIPE_3', 'TIPE_4']);

exports.getQuestions = async (req, res) => {
    try {
        const myExams = await prisma.exams.findMany({ where: { kode_dosen: req.user.id.toString() }, select: { id: true } });
        const myExamIds = myExams.map(e => e.id);

        const questions = await prisma.questions.findMany({ 
            where: { exam_id: { in: myExamIds } }, include: { question_options: true } 
        });

        const formattedData = questions.map(q => ({
            id: q.id,
            exam_id: q.exam_id,
            tipe_soal: q.tipe_soal,
            isi_soal: q.isi_soal,
            kunci_jawaban: q.kunci_jawaban,
            bobot_nilai: q.bobot_nilai,
            cpmk: q.cpmk,
            // Return options for both TIPE_1 and TIPE_2
            opsi_jawaban: (q.tipe_soal === 'TIPE_1' || q.tipe_soal === 'TIPE_2')
                ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan))
                : null,
            question_options: (q.tipe_soal === 'TIPE_1' || q.tipe_soal === 'TIPE_2')
                ? q.question_options
                : []
        }));
        res.status(200).json({ data: formattedData });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil soal." }); }
};

exports.createQuestion = async (req, res) => {
    try {
        const { exam_id, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, bobot_nilai, cpmk } = req.body;
        const examId = toPositiveInt(exam_id);

        // Basic validation
        if (!examId || !ALLOWED_QUESTION_TYPES.has(tipe_soal) || !isNonEmptyString(isi_soal)) {
            return res.status(400).json({ message: "Input soal tidak valid." });
        }

        let parsedOpsi = null;

        // Validasi untuk TIPE_1 (Single Choice - needs options & single answer key)
        if (tipe_soal === 'TIPE_1') {
            if (!isNonEmptyString(kunci_jawaban)) {
                return res.status(400).json({ message: "kunci_jawaban wajib untuk TIPE_1." });
            }
            if (!opsi_jawaban) {
                return res.status(400).json({ message: "opsi_jawaban wajib untuk TIPE_1." });
            }
            parsedOpsi = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban || '[]');
            if (!Array.isArray(parsedOpsi) || parsedOpsi.length < 2) {
                return res.status(400).json({ message: "opsi_jawaban TIPE_1 minimal 2 pilihan." });
            }
        }

        // Validasi untuk TIPE_2 (Multiple Choice - needs options & comma-separated answer key)
        if (tipe_soal === 'TIPE_2') {
            if (!isNonEmptyString(kunci_jawaban)) {
                return res.status(400).json({ message: "kunci_jawaban wajib untuk TIPE_2 (format: A,C,E)." });
            }
            if (!opsi_jawaban) {
                return res.status(400).json({ message: "opsi_jawaban wajib untuk TIPE_2." });
            }
            parsedOpsi = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban || '[]');
            if (!Array.isArray(parsedOpsi) || parsedOpsi.length < 2) {
                return res.status(400).json({ message: "opsi_jawaban TIPE_2 minimal 2 pilihan." });
            }
        }

        // TIPE_3 (Essay) and TIPE_4 (File Upload) don't require opsi_jawaban
        // kunci_jawaban is optional for these types (for reference/rubric)

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menambah soal di ujian ini." });
        }

        // Parse bobot_nilai
        let parsedBobot = 10.00; // default
        if (bobot_nilai !== undefined) {
            parsedBobot = Number.parseFloat(bobot_nilai);
            if (!Number.isFinite(parsedBobot) || parsedBobot < 0) {
                return res.status(400).json({ message: "bobot_nilai harus angka >= 0." });
            }
        }

        const newQuestion = await prisma.questions.create({
            data: {
                exam_id: examId,
                cpmk: cpmk || "CPMK-1",
                tipe_soal,
                isi_soal,
                kunci_jawaban: kunci_jawaban || null,
                bobot_nilai: parsedBobot
            }
        });

        // Create options for TIPE_1 and TIPE_2 (both use multiple choice)
        if ((tipe_soal === 'TIPE_1' || tipe_soal === 'TIPE_2') && parsedOpsi) {
            const opsiData = parsedOpsi.map((teks, index) => ({
                question_id: newQuestion.id,
                label_pilihan: ['A', 'B', 'C', 'D', 'E'][index],  // Support up to E
                teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }
        res.status(201).json({ message: "Soal sukses dibuat!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan soal." }); }
};

exports.updateQuestion = async (req, res) => {
    try {
        const questionId = toPositiveInt(req.params.id);
        if (!questionId) return res.status(400).json({ message: "ID soal tidak valid." });

        const { tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, bobot_nilai, cpmk } = req.body;
        if (tipe_soal && !ALLOWED_QUESTION_TYPES.has(tipe_soal)) {
            return res.status(400).json({ message: "tipe_soal tidak valid." });
        }
        if (isi_soal !== undefined && !isNonEmptyString(isi_soal)) {
            return res.status(400).json({ message: "isi_soal tidak valid." });
        }
        if (cpmk !== undefined && !isNonEmptyString(cpmk)) {
            return res.status(400).json({ message: "cpmk tidak valid." });
        }

        const question = await prisma.questions.findUnique({ where: { id: questionId }, include: { exams: true } });
        if (!question) return res.status(404).json({ message: "Soal tidak ditemukan." });
        if (question.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengubah soal ini." });
        }

        let parsedBobot = question.bobot_nilai;
        if (bobot_nilai !== undefined) {
            parsedBobot = Number.parseFloat(bobot_nilai);
            if (!Number.isFinite(parsedBobot) || parsedBobot < 0) {
                return res.status(400).json({ message: "bobot_nilai harus angka >= 0." });
            }
        }

        await prisma.questions.update({
            where: { id: questionId },
            data: {
                tipe_soal: tipe_soal || question.tipe_soal,
                isi_soal: isi_soal || question.isi_soal,
                kunci_jawaban: kunci_jawaban === undefined ? question.kunci_jawaban : kunci_jawaban,
                bobot_nilai: bobot_nilai === undefined ? question.bobot_nilai : parsedBobot,
                cpmk: cpmk || question.cpmk
            }
        });

        // Update options for TIPE_1 and TIPE_2
        if ((tipe_soal === 'TIPE_1' || tipe_soal === 'TIPE_2') && opsi_jawaban) {
            const opsiArray = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban);
            if (!Array.isArray(opsiArray) || opsiArray.length < 2) {
                return res.status(400).json({ message: "opsi_jawaban minimal 2 pilihan." });
            }
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
            await prisma.question_options.createMany({
                data: opsiArray.map((teks, index) => ({
                    question_id: questionId,
                    label_pilihan: ['A', 'B', 'C', 'D', 'E'][index] || String(index + 1),
                    teks_pilihan: teks
                }))
            });
        }

        // Delete options for TIPE_3 and TIPE_4 (essay/file upload don't need options)
        if (tipe_soal && (tipe_soal === 'TIPE_3' || tipe_soal === 'TIPE_4')) {
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
        }

        return res.status(200).json({ message: "Soal berhasil diperbarui." });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memperbarui soal." });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const questionId = toPositiveInt(req.params.id);
        if (!questionId) return res.status(400).json({ message: "ID soal tidak valid." });
        
        const question = await prisma.questions.findUnique({ where: { id: questionId }, include: { exams: true } });
        if (!question) return res.status(404).json({ message: "Soal tidak ditemukan." });
        if (question.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menghapus soal ini." });
        }

        await prisma.questions.delete({ where: { id: questionId } });
        res.json({ message: "Dihapus!" });
    } 
    catch (error) { res.status(500).json({ message: "Error" }); }
};