const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Masuk Ujian Pakai Token
exports.enterExam = async (req, res) => {
    try {
        const { token_ujian } = req.body;

        const exam = await prisma.exams.findUnique({ where: { token_ujian } });
        if (!exam) return res.status(404).json({ message: "Token Ujian tidak valid!" });

        // Cek Waktu Ujian
        const now = new Date();
        if (now < exam.waktu_mulai || now > exam.waktu_selesai) {
            return res.status(403).json({ message: "Ujian sedang tidak aktif!" });
        }

        // Ambil soal-soal (PENTING: JANGAN SELECT KUNCI_JAWABAN agar tidak dicontek via API)
        const questions = await prisma.questions.findMany({
            where: { exam_id: exam.id },
            select: {
                id: true, cpmk: true, tipe_soal: true, isi_soal: true, bobot_nilai: true,
                question_options: true // Ambil opsi A,B,C,D jika ada
            }
        });

        res.json({ message: "Berhasil masuk ujian!", exam, questions });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};

// 2. Submit Jawaban & Auto-Grading
exports.submitAnswer = async (req, res) => {
    try {
        // Ambil data dari text (req.body) atau file upload (req.file)
        const { exam_id, question_id, jawaban_teks } = req.body;
        const user_id = req.user.id; 
        const file = req.file; 

        // Ambil soal dan kunci jawabannya
        const question = await prisma.questions.findUnique({ where: { id: parseInt(question_id) } });
        if (!question) return res.status(404).json({ message: "Soal tidak ditemukan!" });

        let skor = 0;
        let status = 'selesai'; // Default selesai (dinilai otomatis)

        // --- LOGIKA AUTO-GRADING ---
        if (question.tipe_soal === 'TIPE_1' || question.tipe_soal === 'TIPE_2') {
            // Cek presisi (Pilihan Ganda & Teks Pendek)
            if (jawaban_teks && jawaban_teks.toLowerCase().trim() === question.kunci_jawaban.toLowerCase().trim()) {
                skor = Number(question.bobot_nilai);
            }
        } 
        else if (question.tipe_soal === 'TIPE_3') {
            // Cek Keyword (Esai) - Misal kunci: "oop, encapsulation, inheritance"
            const keywords = question.kunci_jawaban.toLowerCase().split(',');
            let matchCount = 0;
            
            keywords.forEach(kw => {
                if (jawaban_teks && jawaban_teks.toLowerCase().includes(kw.trim())) {
                    matchCount++;
                }
            });
            // Hitung persentase bobot
            skor = (matchCount / keywords.length) * Number(question.bobot_nilai);
        } 
        else if (question.tipe_soal === 'TIPE_4') {
            // Upload Kalkulus (Manual Dosen)
            status = 'menunggu';
            if (!file) return res.status(400).json({ message: "File jawaban wajib diunggah!" });
        }

        // Simpan Jawaban ke Database (Upsert: buat baru jika belum ada, update jika sudah ada)
        // Kita pakai findFirst & update manual karena tabel kita belum punya composite unique key
        const existingResponse = await prisma.student_responses.findFirst({
            where: { user_id: parseInt(user_id), question_id: parseInt(question_id) }
        });

        const dataResponse = {
            user_id: parseInt(user_id),
            exam_id: parseInt(exam_id),
            question_id: parseInt(question_id),
            jawaban_teks: jawaban_teks || null,
            file_path: file ? file.path : null, // Path gambar/PDF
            skor: skor,
            status_penilaian: status
        };

        if (existingResponse) {
            await prisma.student_responses.update({ where: { id: existingResponse.id }, data: dataResponse });
        } else {
            await prisma.student_responses.create({ data: dataResponse });
        }

        res.json({ message: "Jawaban berhasil disimpan!", skor_sementara: skor, status });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};