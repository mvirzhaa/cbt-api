const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiService = require('../services/aiService'); // ✅ Import Otak AI Kapten
const proctoringHeartbeatService = require('../services/proctoringHeartbeatService');
const { isNonEmptyString } = require('../utils/helpers');

exports.verifyToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!isNonEmptyString(token)) {
            return res.status(400).json({ message: "Token ujian tidak valid." });
        }

        const exam = await prisma.exams.findUnique({
            where: { token_ujian: token.toUpperCase() },
            include: {
                mata_kuliah: true,
                // 🔒 select eksplisit: JANGAN sertakan kunci_jawaban, ini dikirim ke mahasiswa
                questions: {
                    select: {
                        id: true,
                        exam_id: true,
                        cpmk: true,
                        tipe_soal: true,
                        isi_soal: true,
                        bobot_nilai: true,
                        question_options: true
                    }
                },
                exam_terms: { orderBy: { urutan: 'asc' } }
            }
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

        // 🔒 user_id WAJIB berasal dari token JWT — jangan fallback ke user lain, gagal jelas jika hilang
        const user_id = req.user?.id;
        if (!user_id) {
            return res.status(401).json({ message: "Sesi tidak valid. Silakan login ulang." });
        }

        const examIdInt = parseInt(exam_id);
        if (!examIdInt) return res.status(400).json({ message: "exam_id tidak valid." });

        // 🔒 Cegah submit ganda: satu mahasiswa hanya boleh mengumpulkan satu kali per ujian
        const existingAttempt = await prisma.exam_attempts.findUnique({
            where: { user_id_exam_id: { user_id, exam_id: examIdInt } }
        });
        if (existingAttempt) {
            return res.status(409).json({ message: "Ujian ini sudah pernah Anda kumpulkan sebelumnya." });
        }

        const questions = await prisma.questions.findMany({
            where: { exam_id: examIdInt },
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
                // Logika Pilihan Ganda Single Choice (A-E)
                const jawabanMhsAman = String(jawabanMhs).trim().toUpperCase();
                const kunciAsli = String(soal.kunci_jawaban).trim().toUpperCase();
                const opsiDipilih = soal.question_options?.find(opt => String(opt.label_pilihan).toUpperCase() === jawabanMhsAman);
                let isCorrect = false;

                if (kunciAsli === jawabanMhsAman) {
                    isCorrect = true;
                } else if ((kunciAsli === "0" && jawabanMhsAman === "A") ||
                           (kunciAsli === "1" && jawabanMhsAman === "B") ||
                           (kunciAsli === "2" && jawabanMhsAman === "C") ||
                           (kunciAsli === "3" && jawabanMhsAman === "D") ||
                           (kunciAsli === "4" && jawabanMhsAman === "E")) {
                    isCorrect = true;
                } else if (opsiDipilih && kunciAsli === String(opsiDipilih.teks_pilihan).trim().toUpperCase()) {
                    isCorrect = true;
                }

                if (isCorrect) skorDidapat = bobot;
                statusNilai = 'selesai';

            } else if (soal.tipe_soal === 'TIPE_2') {
                // Logika Pilihan Ganda Multiple Choice (A-E, bisa pilih lebih dari 1)
                // Format jawaban: "A,B,C" atau ["A","B","C"]
                let jawabanArray = [];
                if (Array.isArray(jawabanMhs)) {
                    jawabanArray = jawabanMhs.map(j => String(j).trim().toUpperCase());
                } else {
                    jawabanArray = String(jawabanMhs).split(',').map(j => j.trim().toUpperCase()).filter(j => j);
                }

                // Kunci jawaban format: "A,B,C"
                const kunciArray = String(soal.kunci_jawaban || "").split(',').map(k => k.trim().toUpperCase()).filter(k => k);

                // Hitung berapa banyak yang benar
                const kunciSet = new Set(kunciArray);
                const jawabanSet = new Set(jawabanArray);

                // Jawaban benar = yang dipilih DAN ada di kunci
                const benarDipilih = jawabanArray.filter(j => kunciSet.has(j)).length;
                // Jawaban salah = yang dipilih tapi TIDAK ada di kunci
                const salahDipilih = jawabanArray.filter(j => !kunciSet.has(j)).length;
                // Jawaban tidak dipilih = yang ada di kunci tapi TIDAK dipilih
                const tidakDipilih = kunciArray.filter(k => !jawabanSet.has(k)).length;

                // Scoring: proporsi jawaban benar
                const totalKunci = kunciArray.length;
                if (totalKunci > 0 && salahDipilih === 0 && tidakDipilih === 0) {
                    // Semua benar, tidak ada salah
                    skorDidapat = bobot;
                } else if (totalKunci > 0) {
                    // Partial scoring: (benar - salah) / total * bobot, minimal 0
                    const nilaiProporsi = Math.max(0, (benarDipilih - salahDipilih) / totalKunci);
                    skorDidapat = nilaiProporsi * bobot;
                } else {
                    skorDidapat = 0;
                }
                statusNilai = 'selesai';

            } else if (soal.tipe_soal === 'TIPE_3') { 
                // 🤖 LOGIKA AI (ESAI)
                skorDidapat = null; 
                statusNilai = 'menunggu'; 
                
                if (jawabanMhs) {
                    antreanEsaiAI.push({
                        question_id: soal.id,
                        soalTeks: soal.isi_soal || "Soal Esai IT",
                        kunciJawaban: soal.kunci_jawaban || "",
                        jawabanMhs: jawabanMhs
                    });
                }
            } else if (soal.tipe_soal === 'TIPE_4') { 
                // 📁 LOGIKA UPLOAD
                skorDidapat = null; 
                statusNilai = 'menunggu'; 
            }

            rekamJawaban.push({
                user_id: user_id, exam_id: examIdInt, question_id: soal.id,
                jawaban_teks: jawabanMhs, file_path: pathFile, skor: skorDidapat, status_penilaian: statusNilai
            });
            totalSkorDiperoleh += (skorDidapat || 0);
        }

        // Hitung skor_pilgan_100 (skala 0-100) dari jawaban yang baru dirakit (in-memory)
        // TIPE_1 dan TIPE_2 sekarang keduanya pilihan ganda (auto-grading)
        let maxPilgan = 0;
        questions.forEach(soal => {
            if (soal.tipe_soal === 'TIPE_1' || soal.tipe_soal === 'TIPE_2') {
                maxPilgan += soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10.0;
            }
        });
        let rawPilgan = 0;
        rekamJawaban.forEach(r => {
            const soal = questions.find(q => q.id === r.question_id);
            if (soal?.tipe_soal === 'TIPE_1' || soal?.tipe_soal === 'TIPE_2') {
                rawPilgan += r.skor;
            }
        });
        const skor_pilgan_100 = maxPilgan > 0 ? Math.round((rawPilgan / maxPilgan) * 100) : 0;

        // 🔒 Simpan jawaban + buat exam_attempts dalam satu transaksi atomik.
        // Pakai create (bukan upsert) + skipDuplicates: jika ada request submit ganda yang lolos
        // race window pengecekan di atas, unique constraint (user_id, exam_id) pada exam_attempts
        // akan menolaknya dengan P2002 alih-alih diam-diam menimpa/menduplikasi data.
        try {
            await prisma.$transaction([
                prisma.student_responses.createMany({ data: rekamJawaban, skipDuplicates: true }),
                prisma.exam_attempts.create({
                    data: {
                        user_id,
                        exam_id: examIdInt,
                        skor_pilgan_100, // Only multiple choice scores (auto-graded)
                        skor_esai_100: 0, // Will be calculated later via batch endpoint
                        skor_file_100: 0, // Will be manually graded by dosen
                        status: 'MENUNGGU_VERIFIKASI', // Human-in-the-Loop: awaiting dosen verification
                        submitted_at: new Date()
                    }
                })
            ]);
        } catch (txError) {
            if (txError.code === 'P2002') {
                return res.status(409).json({ message: "Ujian ini sudah pernah Anda kumpulkan sebelumnya." });
            }
            throw txError;
        }

        // 💓 Ujian sudah selesai dikumpulkan — hentikan pelacakan heartbeat supaya
        // sweep proctoring tidak salah mencatat "AI tidak aktif" setelah ujian berakhir.
        proctoringHeartbeatService.stopTracking(user_id, examIdInt);

        // 🤖 PHASE 1 OPTIMIZED: AI Queue for Essay Grading
        // FIX 1B: Soft limit handled in aiService.addToQueue()
        if (antreanEsaiAI.length > 0) {
            const savedResponses = await prisma.student_responses.findMany({
                where: { user_id: user_id, exam_id: examIdInt }
            });

            let queuedCount = 0;
            let rejectedCount = 0;

            antreanEsaiAI.forEach(esai => {
                const dbRecord = savedResponses.find(r => r.question_id === esai.question_id);
                if (dbRecord) {
                    // Add to queue (non-blocking, async processing)
                    const added = aiService.addToQueue(
                        dbRecord.id,
                        esai.soalTeks,
                        esai.kunciJawaban,
                        esai.jawabanMhs,
                        user_id,
                        examIdInt
                    );

                    if (added) {
                        queuedCount++;
                    } else {
                        rejectedCount++;
                    }
                }
            });

            console.log(`[Submit Exam] AI Queue: ${queuedCount} queued, ${rejectedCount} rejected (queue full)`);
        }

        // CRITICAL: Return response immediately (don't await AI processing)
        // AI grading happens in background, dosen will verify later

        // Hitung ringkasan hasil untuk ditampilkan ke mahasiswa
        const jumlahPilgan = questions.filter(q => q.tipe_soal === 'TIPE_1' || q.tipe_soal === 'TIPE_2').length;
        const jumlahEsai   = questions.filter(q => q.tipe_soal === 'TIPE_3').length;
        const jumlahUpload = questions.filter(q => q.tipe_soal === 'TIPE_4').length;

        res.status(200).json({
            message: "Ujian berhasil dikumpulkan! Nilai Anda sedang menunggu verifikasi dosen.",
            status: "MENUNGGU_VERIFIKASI",
            note: antreanEsaiAI.length > 0
                ? "Soal esai sedang diproses AI. Dosen akan memverifikasi hasilnya."
                : null,
            hasil: {
                skor_pilgan_sementara: skor_pilgan_100,   // Skor pilgan skala 0-100 (auto-graded)
                jumlah_soal: {
                    total: questions.length,
                    pilgan: jumlahPilgan,
                    esai: jumlahEsai,
                    upload: jumlahUpload
                },
                menunggu_koreksi: jumlahEsai + jumlahUpload > 0,
                keterangan: jumlahEsai + jumlahUpload > 0
                    ? `${jumlahEsai > 0 ? `${jumlahEsai} soal esai` : ''}${jumlahEsai > 0 && jumlahUpload > 0 ? ' dan ' : ''}${jumlahUpload > 0 ? `${jumlahUpload} soal upload` : ''} masih menunggu koreksi dosen.`
                    : "Semua soal sudah dinilai otomatis."
            }
        });
    } catch (error) { 
        console.error("❌ ERROR SUBMIT:", error);
        res.status(500).json({ message: "Gagal menyimpan ujian ke database." }); 
    }
};

exports.getHistory = async (req, res) => {
    try {
        // 🔒 user_id WAJIB berasal dari token JWT — jangan fallback ke user lain
        const user_id = req.user?.id;
        if (!user_id) {
            return res.status(401).json({ message: "Sesi tidak valid. Silakan login ulang." });
        }

        // 🆕 Query dari exam_attempts — sumber kebenaran tunggal untuk riwayat
        const attempts = await prisma.exam_attempts.findMany({
            where: { user_id },
            include: { exams: { include: { mata_kuliah: true } } },
            orderBy: { submitted_at: 'desc' }
        });

        const historyData = attempts.map(attempt => ({
            attempt_id: attempt.id,
            exam_id: attempt.exam_id,
            exam_nama: attempt.exams.nama_ujian,
            matkul: attempt.exams.mata_kuliah?.nama_mk || '-',
            // 🔒 Nilai hanya ditampilkan jika sudah diverifikasi dosen
            status: attempt.status,
            final_score: attempt.status === 'SELESAI'
                ? parseFloat(attempt.final_score || 0)
                : null,
            skor_pilgan_100: parseFloat(attempt.skor_pilgan_100 || 0),
            skor_esai_100: parseFloat(attempt.skor_esai_100 || 0),
            skor_file_100: parseFloat(attempt.skor_file_100 || 0),
            grading_type: attempt.exams.grading_type,
            submitted_at: attempt.submitted_at,
            verified_at: attempt.verified_at
        }));

        res.status(200).json({ data: historyData });
    } catch (error) { 
        console.error("❌ ERROR GET HISTORY:", error);
        res.status(500).json({ message: "Gagal menarik riwayat" }); 
    }
};

// Info token untuk SATU ujian (dipakai LMS eksternal utk tampilkan token ke mahasiswa
// otomatis begitu jendela waktu ujian buka, tanpa dosen perlu umumkan manual).
// token_ujian sengaja null di luar jendela waktu — jaga level proteksi yang sama
// dengan toleransi 5 menit di verifyToken.
exports.getExamToken = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID ujian tidak valid." });

        const exam = await prisma.exams.findUnique({
            where: { id },
            select: { id: true, nama_ujian: true, waktu_mulai: true, waktu_selesai: true, token_ujian: true }
        });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });

        const now = new Date();
        const waktuMulaiToleransi = new Date(new Date(exam.waktu_mulai).getTime() - (5 * 60000));
        const isOpen = now >= waktuMulaiToleransi && now <= new Date(exam.waktu_selesai);

        return res.status(200).json({
            data: {
                id: exam.id,
                nama_ujian: exam.nama_ujian,
                waktu_mulai: exam.waktu_mulai,
                waktu_selesai: exam.waktu_selesai,
                is_open: isOpen,
                token_ujian: isOpen ? exam.token_ujian : null,
            },
        });
    } catch (error) {
        console.error('[Get Exam Token]', error);
        res.status(500).json({ message: "Gagal mengambil info token ujian." });
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