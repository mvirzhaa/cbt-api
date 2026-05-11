const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// const stringSimilarity = require('string-similarity'); // ❌ Sudah tidak dipakai, diganti AI
const aiService = require('../services/aiService'); // ✅ Import Otak AI Kapten
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
        
        // 🌟 LOGIKA BARU: Merakit ulang answers dari FormData (Multipart) maupun JSON
        let answers = {};
        
        // Jika dikirim via JSON biasa (Fallback aman)
        if (req.body.answers && typeof req.body.answers === 'object') {
            answers = req.body.answers;
        } else if (req.body.answers && typeof req.body.answers === 'string') {
            try { answers = JSON.parse(req.body.answers); } catch(e) {}
        } else {
            // Jika dikirim via FormData (Format: answers[123] = "Jawaban")
            Object.keys(req.body).forEach(key => {
                if (key.startsWith('answers[')) {
                    // Ekstrak ID soal dari string "answers[123]" -> "123"
                    const match = key.match(/\[(.*?)\]/);
                    if (match && match[1]) {
                        const questionId = match[1];
                        answers[questionId] = req.body[key];
                    }
                }
            });
        }

        const user_id = req.user?.userId || req.user?.id || req.userId || 1; 

        const questions = await prisma.questions.findMany({ 
            where: { exam_id: parseInt(exam_id) },
            include: { question_options: true }
        });
        
        if (questions.length === 0) return res.status(404).json({ message: "Soal tidak ditemukan." });

        const rekamJawaban = [];
        let totalSkorDiperoleh = 0;
        const antreanEsaiAI = []; // 🤖 Keranjang untuk menampung soal esai

        for (const soal of questions) {
            const jawabanMhs = answers[soal.id.toString()] || "";
            
            // 📁 Logika File Upload (Diambil dari multer req.files)
            const fileTerlampir = req.files ? req.files.find(f => f.fieldname === `file_${soal.id}`) : null;
            const pathFile = fileTerlampir ? fileTerlampir.path.replace(/\\/g, "/") : null;
            
            let skorDidapat = 0;
            let statusNilai = 'menunggu';
            const bobot = soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10.0;

            if (soal.tipe_soal === 'TIPE_1') { 
                // Logika Pilihan Ganda
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
                // 🤖 LOGIKA AI (ESAI)
                skorDidapat = 0; 
                statusNilai = 'menunggu'; 
                
                if (jawabanMhs && soal.kunci_jawaban) {
                    antreanEsaiAI.push({
                        question_id: soal.id,
                        soalTeks: soal.isi_soal || "Soal Esai IT",
                        kunciJawaban: soal.kunci_jawaban,
                        jawabanMhs: jawabanMhs
                    });
                }
            } else if (soal.tipe_soal === 'TIPE_4') { 
                // 📁 LOGIKA UPLOAD
                skorDidapat = 0; 
                statusNilai = 'menunggu'; 
            }

            rekamJawaban.push({
                user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                jawaban_teks: jawabanMhs, file_path: pathFile, skor: skorDidapat, status_penilaian: statusNilai 
            });
            totalSkorDiperoleh += skorDidapat;
        }

        // 1. Simpan semua jawaban ke Database
        await prisma.student_responses.createMany({ data: rekamJawaban });

        // 2. 🤖 EKSEKUSI AI QUEUE 🤖
        if (antreanEsaiAI.length > 0) {
            const savedResponses = await prisma.student_responses.findMany({
                where: { user_id: user_id, exam_id: parseInt(exam_id) }
            });

            antreanEsaiAI.forEach(esai => {
                const dbRecord = savedResponses.find(r => r.question_id === esai.question_id);
                if (dbRecord) {
                    aiService.addToQueue(
                        dbRecord.id, 
                        esai.soalTeks, 
                        esai.kunciJawaban, 
                        esai.jawabanMhs
                    );
                }
            });
        }

        res.status(200).json({ message: "Ujian direkam!", info_nilai: `Skor Otomatis: ${totalSkorDiperoleh}` });
    } catch (error) { 
        console.error("❌ ERROR SUBMIT:", error);
        res.status(500).json({ message: "Gagal menyimpan ujian ke database." }); 
    }
};

exports.getHistory = async (req, res) => {
    try {
        const user_id = req.user?.userId || req.user?.id || req.userId || 1;
        
        // Tarik data jawaban beserta detail soal dan ujiannya
        const responses = await prisma.student_responses.findMany({
            where: { user_id: user_id }, 
            include: { 
                exams: { include: { mata_kuliah: true } },
                questions: true // WAJIB di-include agar mesin tahu bobot per soal
            }
        });

        // Kelompokkan jawaban berdasarkan ID Ujian
        const groupedByExam = {};
        responses.forEach(resp => {
            if (!groupedByExam[resp.exam_id]) {
                groupedByExam[resp.exam_id] = {
                    examConfig: resp.exams,
                    responses: [],
                    questions: []
                };
            }
            groupedByExam[resp.exam_id].responses.push(resp);
            // Hindari duplikasi soal di array
            if (!groupedByExam[resp.exam_id].questions.find(q => q.id === resp.questions.id)) {
                groupedByExam[resp.exam_id].questions.push(resp.questions);
            }
        });

        // Proses dengan Mesin Penilai Utama (gradingService)
        const historyData = [];
        for (const examId in groupedByExam) {
            const data = groupedByExam[examId];
            
            // 🌟 PANGGIL MESIN PENILAI
            const gradingResult = gradingService.calculateFinalScore(
                data.responses, 
                data.questions, 
                data.examConfig
            );

            historyData.push({
                exam_id: examId,
                exam_nama: data.examConfig.nama_ujian,
                matkul: data.examConfig.mata_kuliah?.nama_mk || '-',
                total_skor: gradingResult.totalScore, // Nilai mutlak/persentase yang sudah akurat
                breakdown: gradingResult.breakdown,   // Rincian per kategori (Pilgan, Esai, Upload)
                status: gradingResult.isAllGraded ? 'Selesai Dinilai' : 'Menunggu Koreksi Dosen/AI',
                grading_type: data.examConfig.grading_type
            });
        }

        res.status(200).json({ data: historyData });
    } catch (error) { 
        console.error("❌ ERROR GET HISTORY:", error);
        res.status(500).json({ message: "Gagal menarik riwayat" }); 
    }
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