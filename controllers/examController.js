const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, toValidDate, isNonEmptyString } = require('../utils/helpers');

const ALLOWED_GRADING_TYPES = new Set(['PER_KATEGORI', 'PER_SOAL']);

// 1. Tarik Daftar Ujian Dosen
exports.getAllExams = async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: req.user.role === 'super_admin' ? {} : { kode_dosen: req.user.id.toString() },
            include: { mata_kuliah: true, exam_terms: { orderBy: { urutan: 'asc' } }, _count: { select: { questions: true } } },
            orderBy: { waktu_mulai: 'desc' }
        });
        const withJumlahSoal = exams.map(({ _count, ...exam }) => ({ ...exam, jumlah_soal: _count.questions }));
        res.status(200).json({ data: withJumlahSoal });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data ujian." }); }
};

// 2. Terbitkan Ujian Baru
exports.createExam = async (req, res) => {
    try {
        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi, bobot_pilgan, bobot_esai, bobot_upload, grading_type, exam_terms } = req.body;
        const rawUserId = req.user && req.user.id;
        const durasiInt = toPositiveInt(durasi);
        const waktuMulaiDate = toValidDate(waktu_mulai);
        const waktuSelesaiDate = toValidDate(waktu_selesai);

        if (!rawUserId) return res.status(401).json({ message: "Identitas tidak ditemukan." });
        if (!isNonEmptyString(kode_mk) || !isNonEmptyString(nama_ujian) || !waktuMulaiDate || !waktuSelesaiDate || !durasiInt) {
            return res.status(400).json({ message: "Input ujian tidak valid." });
        }
        if (waktuMulaiDate >= waktuSelesaiDate) return res.status(400).json({ message: "waktu_mulai harus lebih kecil dari waktu_selesai." });
        if (grading_type !== undefined && !ALLOWED_GRADING_TYPES.has(grading_type)) {
            return res.status(400).json({ message: "grading_type harus PER_KATEGORI atau PER_SOAL." });
        }

        const token_ujian = Math.random().toString(36).substring(2, 8).toUpperCase();

        const dataPayload = {
            kode_mk, kode_dosen: rawUserId.toString(), nama_ujian, token_ujian,
            waktu_mulai: waktuMulaiDate, waktu_selesai: waktuSelesaiDate, durasi: durasiInt,
            bobot_pilgan: parseInt(bobot_pilgan) || 0,
            bobot_esai: parseInt(bobot_esai) || 0,
            bobot_upload: parseInt(bobot_upload) || 0,
            grading_type: grading_type || 'PER_KATEGORI'
        };

        if (Array.isArray(exam_terms) && exam_terms.length > 0) {
            dataPayload.exam_terms = {
                create: exam_terms.map((term, index) => ({ isi_syarat: term, urutan: index }))
            };
        }

        const newExam = await prisma.exams.create({ data: dataPayload });
        res.status(201).json({ message: "Ujian berhasil diterbitkan!", data: newExam });
    } catch (error) { res.status(500).json({ message: "Gagal menerbitkan ujian." }); }
};

// 3. EDIT Ujian (Super Safe Mode & Custom Formula)
exports.updateExam = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi, bobot_pilgan, bobot_esai, bobot_upload, grading_type, exam_terms } = req.body;

        const waktuMulaiDate = new Date(waktu_mulai);
        const waktuSelesaiDate = new Date(waktu_selesai);

        if (isNaN(waktuMulaiDate.getTime()) || isNaN(waktuSelesaiDate.getTime())) {
            return res.status(400).json({ message: "Format waktu pelaksanaan tidak valid." });
        }
        if (waktuMulaiDate >= waktuSelesaiDate) {
            return res.status(400).json({ message: "Waktu mulai harus lebih awal dari waktu selesai." });
        }
        if (grading_type !== undefined && !ALLOWED_GRADING_TYPES.has(grading_type)) {
            return res.status(400).json({ message: "grading_type harus PER_KATEGORI atau PER_SOAL." });
        }

        const examCheck = await prisma.exams.findUnique({ where: { id } });
        if (!examCheck) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (req.user.role !== 'super_admin' && examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengedit ujian ini." });
        }

        const updatePayload = {
            kode_mk: kode_mk,
            nama_ujian: nama_ujian,
            waktu_mulai: waktuMulaiDate,
            waktu_selesai: waktuSelesaiDate,
            durasi: parseInt(durasi) || 90,
            bobot_pilgan: parseInt(bobot_pilgan) || 0,
            bobot_esai: parseInt(bobot_esai) || 0,
            bobot_upload: parseInt(bobot_upload) || 0,
            grading_type: grading_type || examCheck.grading_type || 'PER_KATEGORI'
        };

        if (Array.isArray(exam_terms)) {
            updatePayload.exam_terms = {
                deleteMany: {},
                create: exam_terms.map((term, index) => ({ isi_syarat: term, urutan: index }))
            };
        }

        const updatedExam = await prisma.exams.update({
            where: { id },
            data: updatePayload
        });

        res.status(200).json({ message: "Ujian berhasil diperbarui!", data: updatedExam });
    } catch (error) {
        console.error("❌ ERROR PUT EXAM:", error); 
        res.status(500).json({ message: "Gagal memperbarui ujian di database." });
    }
};

// 4. REKAP NILAI RINCI DENGAN CUSTOM FORMULA DOSEN
exports.getExamRekapDetail = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });
        
        const exam = await prisma.exams.findUnique({ 
            where: { id: examId },
            include: { questions: true }
        });
        
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString()) return res.status(403).json({ message: "Akses Ditolak!" });

        // 🔧 TIPE_1 & TIPE_2 keduanya pilihan ganda (auto-graded), hanya TIPE_3 yang esai (AI-graded) —
        // harus konsisten dengan gradingService.calculateFinalScore & gradingController.
        let maxPilgan = 0, maxEsai = 0, maxUpload = 0;
        exam.questions.forEach(q => {
            const bobotSoal = parseFloat(q.bobot_nilai || 10);
            if (q.tipe_soal === 'TIPE_1' || q.tipe_soal === 'TIPE_2') maxPilgan += bobotSoal;
            else if (q.tipe_soal === 'TIPE_3') maxEsai += bobotSoal;
            else if (q.tipe_soal === 'TIPE_4') maxUpload += bobotSoal;
        });

        const responses = await prisma.student_responses.findMany({
            where: { exam_id: examId },
            include: { users: { select: { nama: true } }, questions: { select: { tipe_soal: true } } }
        });

        const studentScores = {};

        responses.forEach(r => {
            const uid = r.user_id;
            if (!studentScores[uid]) {
                studentScores[uid] = {
                    nama_mahasiswa: r.users?.nama || 'Anonim',
                    raw_pilgan: 0, raw_esai: 0, raw_upload: 0,
                    status: 'Selesai'
                };
            }

            const tipe = r.questions?.tipe_soal;
            const skor = parseFloat(r.skor || 0);

            if (tipe === 'TIPE_1' || tipe === 'TIPE_2') studentScores[uid].raw_pilgan += skor;
            else if (tipe === 'TIPE_3') studentScores[uid].raw_esai += skor;
            else if (tipe === 'TIPE_4') studentScores[uid].raw_upload += skor;

            if (r.status_penilaian === 'menunggu') studentScores[uid].status = 'Menunggu Koreksi Dosen';
        });

        const finalResults = Object.values(studentScores).map(student => {
            const nilaiPilgan = maxPilgan > 0 ? (student.raw_pilgan / maxPilgan) * exam.bobot_pilgan : 0;
            const nilaiEsai = maxEsai > 0 ? (student.raw_esai / maxEsai) * exam.bobot_esai : 0;
            const nilaiUpload = maxUpload > 0 ? (student.raw_upload / maxUpload) * exam.bobot_upload : 0;

            return {
                nama_mahasiswa: student.nama_mahasiswa,
                skor_pilgan: nilaiPilgan,
                skor_esai: nilaiEsai,
                skor_upload: nilaiUpload,
                total_skor: nilaiPilgan + nilaiEsai + nilaiUpload,
                status: student.status
            };
        });

        res.status(200).json({ data: finalResults });
    } catch (error) {
        console.error("❌ ERROR GET REKAP DETAIL:", error);
        res.status(500).json({ message: "Gagal menarik rincian nilai." });
    }
};

// 5. HAPUS Ujian (cascade ke questions/student_responses/exam_attempts/exam_terms/exam_violations lewat schema)
exports.deleteExam = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID ujian tidak valid." });

        const exam = await prisma.exams.findUnique({ where: { id } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (req.user.role !== 'super_admin' && exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menghapus ujian ini." });
        }

        await prisma.exams.delete({ where: { id } });
        res.status(200).json({ message: "Ujian berhasil dihapus." });
    } catch (error) {
        console.error("❌ ERROR DELETE EXAM:", error);
        res.status(500).json({ message: "Gagal menghapus ujian." });
    }
};