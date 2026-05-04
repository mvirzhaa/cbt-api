const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stringSimilarity = require('string-similarity');
const { isNonEmptyString } = require('../utils/helpers');

exports.verifyToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!isNonEmptyString(token)) {
            return res.status(400).json({ message: "Token ujian tidak valid." });
        }

        const exam = await prisma.exams.findUnique({
            where: { token_ujian: token.toUpperCase() }, 
            include: { mata_kuliah: true, questions: { include: { question_options: true } } }
        });

        if (!exam) return res.status(404).json({ message: "Token Ujian tidak ditemukan di database." });

        const now = new Date();
        const waktuMulaiToleransi = new Date(new Date(exam.waktu_mulai).getTime() - (5 * 60000));
        
        if (now < waktuMulaiToleransi) {
            const formatJam = new Date(exam.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return res.status(403).json({ message: `Ujian belum dimulai. Sesi dibuka pukul ${formatJam} WIB.` });
        }
        if (now > new Date(exam.waktu_selesai)) {
            return res.status(403).json({ message: "Akses ditolak. Sesi ujian ini telah resmi ditutup." });
        }

        res.status(200).json({ message: "Akses Diberikan!", data: { exam: exam, questions: exam.questions } });
    } catch (error) { res.status(500).json({ message: "Gagal memverifikasi token." }); }
};

exports.submitExam = async (req, res) => {
    try {
        const { exam_id } = req.body;
        let answers = req.body.answers;
        if (typeof answers === 'string') answers = JSON.parse(answers);
        answers = answers || {};

        const user_id = req.user ? req.user.id : (req.userId || 1); 

        const questions = await prisma.questions.findMany({ 
            where: { exam_id: parseInt(exam_id) },
            include: { question_options: true }
        });
        
        if (questions.length === 0) return res.status(404).json({ message: "Soal tidak ditemukan." });

        const rekamJawaban = [];
        let totalSkorDiperoleh = 0;

        for (const soal of questions) {
            const jawabanMhs = answers[soal.id.toString()] || "";
            const fileTerlampir = req.files ? req.files.find(f => f.fieldname === `file_${soal.id}`) : null;
            const pathFile = fileTerlampir ? fileTerlampir.path.replace(/\\/g, "/") : null;
            
            let skorDidapat = 0;
            let statusNilai = 'menunggu';
            const bobot = soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10.0;

            if (soal.tipe_soal === 'TIPE_1') { 
                const jawabanMhsAman = String(jawabanMhs).trim().toUpperCase(); 
                const kunciAsli = String(soal.kunci_jawaban).trim().toUpperCase(); 
                
                const opsiDipilih = soal.question_options?.find(opt => String(opt.label_pilihan).toUpperCase() === jawabanMhsAman);

                let isCorrect = false;

                if (kunciAsli === jawabanMhsAman) {
                    isCorrect = true;
                } else if ((kunciAsli === "0" && jawabanMhsAman === "A") ||
                           (kunciAsli === "1" && jawabanMhsAman === "B") ||
                           (kunciAsli === "2" && jawabanMhsAman === "C") ||
                           (kunciAsli === "3" && jawabanMhsAman === "D")) {
                    isCorrect = true;
                } else if (opsiDipilih && kunciAsli === String(opsiDipilih.teks_pilihan).trim().toUpperCase()) {
                    isCorrect = true;
                }

                if (isCorrect) skorDidapat = bobot; 
                statusNilai = 'selesai';

            } else if (soal.tipe_soal === 'TIPE_3') { 
                if (jawabanMhs && soal.kunci_jawaban) {
                    const similarity = stringSimilarity.compareTwoStrings(jawabanMhs.toLowerCase(), soal.kunci_jawaban.toLowerCase());
                    skorDidapat = Math.round(similarity * bobot * 100) / 100;
                }
                statusNilai = 'selesai'; 
            } else if (soal.tipe_soal === 'TIPE_4') { 
                skorDidapat = 0; statusNilai = 'menunggu'; 
            }

            rekamJawaban.push({
                user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                jawaban_teks: jawabanMhs, file_path: pathFile, skor: skorDidapat, status_penilaian: statusNilai 
            });
            totalSkorDiperoleh += skorDidapat;
        }

        await prisma.student_responses.createMany({ data: rekamJawaban });
        res.status(200).json({ message: "Ujian direkam!", info_nilai: `Skor Otomatis: ${totalSkorDiperoleh}` });
    } catch (error) { 
        console.error("❌ ERROR SUBMIT:", error);
        res.status(500).json({ message: "Gagal menyimpan ujian ke database." }); 
    }
};

exports.getHistory = async (req, res) => {
    try {
        const user_id = req.user ? req.user.id : req.userId;
        const responses = await prisma.student_responses.findMany({
            where: { user_id: user_id }, include: { exams: { include: { mata_kuliah: true } } }
        });

        const rekapNilai = {};
        responses.forEach(resp => {
            const exId = resp.exam_id;
            if (!rekapNilai[exId]) rekapNilai[exId] = { exam_nama: resp.exams?.nama_ujian || 'Unknown', matkul: resp.exams?.mata_kuliah?.nama_mk || '-', total_skor: 0, status: 'Selesai Dinilai' };
            rekapNilai[exId].total_skor += parseFloat(resp.skor || 0);
            if (resp.status_penilaian === 'menunggu') rekapNilai[exId].status = 'Menunggu Koreksi Dosen';
        });
        res.status(200).json({ data: Object.values(rekapNilai) });
    } catch (error) { res.status(500).json({ message: "Gagal menarik riwayat" }); }
};

exports.getExams = async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: { 
                waktu_selesai: {
                    gte: new Date()
                }
            },
            select: {
                id: true,
                nama_ujian: true,
                kode_mk: true,
                durasi: true,
                waktu_mulai: true,
                waktu_selesai: true,
                mata_kuliah: {
                    select: {
                        nama_mk: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        return res.json({ success: true, data: exams });
    } catch (error) {
        console.error('[Get Student Exams]', error);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};