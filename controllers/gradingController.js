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

            // 🔧 Rekap ini adalah PREVIEW sebelum dosen verifikasi resmi di dosenController.verifyExam.
            // Dipakai grading_type asli tiap ujian supaya angka preview konsisten dengan nilai akhir
            // yang akan dipublikasikan verifyExam (yang juga bercabang berdasarkan grading_type ini).
            const gradingResult = gradingService.calculateFinalScore(
                data.responses,
                data.questions,
                data.examConfig
            );

            finalScores.push({
                nama_mahasiswa: data.nama_mahasiswa,
                nama_ujian: data.examConfig.nama_ujian,
                total_skor: gradingResult.totalScore, // Skor akurat sesuai rumus persentase berbobot
                rincian: gradingResult.breakdown, // Bawa rincian Pilgan/Esai/Upload ke Frontend Web
                status: gradingResult.isAllGraded ? 'Selesai' : 'Menunggu Koreksi',
                grading_type: data.examConfig.grading_type || 'PER_KATEGORI'
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
                questions: { select: { isi_soal: true, tipe_soal: true, kunci_jawaban: true, bobot_nilai: true } }
            }
        });
        res.status(200).json({ data: answers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data jawaban." }); }
};

// 🌟 Endpoint baru: Mendapatkan SEMUA jawaban (termasuk yang sudah dinilai)
exports.getAllAnswers = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak!" });
        }

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: examId },
            include: {
                users: { select: { nama: true, nim: true } },
                questions: {
                    select: {
                        isi_soal: true,
                        tipe_soal: true,
                        kunci_jawaban: true,
                        bobot_nilai: true,
                        question_options: {
                            select: {
                                label_pilihan: true,
                                teks_pilihan: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { user_id: 'asc' },
                { question_id: 'asc' }
            ]
        });

        // Format jawaban agar properti questions memiliki opsi_jawaban berupa string JSON object
        const formattedAnswers = answers.map(ans => {
            const question = ans.questions;
            let opsi_jawaban = null;
            if (question && question.question_options && question.question_options.length > 0) {
                const opsiObj = {};
                question.question_options.forEach(opt => {
                    opsiObj[opt.label_pilihan] = opt.teks_pilihan;
                });
                opsi_jawaban = JSON.stringify(opsiObj);
            }
            
            const { question_options, ...restQuestion } = question;
            
            return {
                ...ans,
                questions: {
                    ...restQuestion,
                    opsi_jawaban
                }
            };
        });

        res.status(200).json({ data: formattedAnswers });
    } catch (error) {
        console.error("❌ ERROR GET ALL ANSWERS:", error);
        res.status(500).json({ message: "Gagal mengambil data jawaban." });
    }
};

// 🌟 Endpoint baru: Mendapatkan semua jawaban per mahasiswa
exports.getStudentAnswers = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        const studentId = toPositiveInt(req.params.student_id);

        if (!examId || !studentId) {
            return res.status(400).json({ message: "ID ujian atau mahasiswa tidak valid." });
        }

        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak!" });
        }

        const answers = await prisma.student_responses.findMany({
            where: {
                exam_id: examId,
                user_id: studentId
            },
            include: {
                users: { select: { nama: true, nim: true } },
                questions: {
                    select: {
                        isi_soal: true,
                        tipe_soal: true,
                        kunci_jawaban: true,
                        bobot_nilai: true,
                        question_options: {
                            select: {
                                label_pilihan: true,
                                teks_pilihan: true
                            }
                        }
                    }
                }
            },
            orderBy: { question_id: 'asc' }
        });

        // Format jawaban agar properti questions memiliki opsi_jawaban berupa string JSON object
        const formattedAnswers = answers.map(ans => {
            const question = ans.questions;
            let opsi_jawaban = null;
            if (question && question.question_options && question.question_options.length > 0) {
                const opsiObj = {};
                question.question_options.forEach(opt => {
                    opsiObj[opt.label_pilihan] = opt.teks_pilihan;
                });
                opsi_jawaban = JSON.stringify(opsiObj);
            }
            
            const { question_options, ...restQuestion } = question;
            
            return {
                ...ans,
                questions: {
                    ...restQuestion,
                    opsi_jawaban
                }
            };
        });

        res.status(200).json({ data: formattedAnswers });
    } catch (error) {
        console.error("❌ ERROR GET STUDENT ANSWERS:", error);
        res.status(500).json({ message: "Gagal mengambil data jawaban mahasiswa." });
    }
};

exports.submitScore = async (req, res) => {
    try {
        const responseId = toPositiveInt(req.params.response_id);
        const scoreValue = Number.parseFloat(req.body.skor);

        if (!responseId || !Number.isFinite(scoreValue) || scoreValue < 0) {
            return res.status(400).json({ message: "Skor harus berupa angka >= 0." });
        }

        const response = await prisma.student_responses.findUnique({
            where: { id: responseId },
            include: { exams: true, questions: { select: { bobot_nilai: true } } }
        });

        if (!response) return res.status(404).json({ message: "Jawaban tidak ditemukan." });
        if (response.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menilai jawaban ini." });
        }

        // FIX 2026-08-22: scoreValue dari dosen itu SUDAH skala poin (0..bobot
        // soal ini), sama kayak FE (Grading.jsx) yang nampilin "Bobot: X" di
        // kartu soal -- sebelumnya BE malah validasi & terima 0-100 flat, gak
        // peduli bobot_nilai soal (bobot 20 tapi skor bisa ketulis 76), bikin
        // SIAKAD nolak push (skorDiperoleh > skorMaksimal). Sekarang divalidasi
        // ketat terhadap bobot_nilai soal ini, ditulis apa adanya (gak dikonversi).
        const bobotNilai = parseFloat(response.questions?.bobot_nilai || 10);
        if (scoreValue > bobotNilai) {
            return res.status(400).json({ message: `Skor tidak boleh melebihi bobot soal ini (${bobotNilai}).` });
        }
        const skorPoin = scoreValue;

        const updatedResponse = await prisma.student_responses.update({
            where: { id: responseId },
            data: { skor: skorPoin, status_penilaian: 'selesai' },
            include: { questions: { select: { tipe_soal: true } } }
        });

        // 🔄 Recalculate skor di exam_attempts setelah dosen mengupdate nilai
        try {
            const allResponses = await prisma.student_responses.findMany({
                where: { user_id: response.user_id, exam_id: response.exam_id },
                include: { questions: { select: { tipe_soal: true, bobot_nilai: true } } }
            });
            
            let gradedBobotEsai = 0, totalNilaiEsaiBerbobot = 0;
            let gradedBobotFile = 0, totalNilaiFileBerbobot = 0;

            allResponses.forEach(r => {
                const bobot = parseFloat(r.questions.bobot_nilai || 10);

                // FIX 2026-08-22: r.skor sekarang SELALU dalam skala POIN (0..bobot
                // soal itu sendiri), bukan 0-100 lagi -- baik dari AI grading
                // (aiService.js) maupun dari submitScore manual (fix di atas).
                // Weighted-average-jadi-0-100 yang benar itu Σskor / Σbobot × 100,
                // BUKAN Σ(skor×bobot) -- itu double-counting bobot-nya.
                // TIPE_2 sekarang pilihan ganda multiple choice, bukan esai
                // Hanya TIPE_3 yang esai (AI grading)
                if (r.questions.tipe_soal === 'TIPE_3') {
                    if (r.skor !== null) {
                        const skor = parseFloat(r.skor || 0); // skala poin, 0..bobot
                        gradedBobotEsai += bobot;
                        totalNilaiEsaiBerbobot += skor;
                    }
                } else if (r.questions.tipe_soal === 'TIPE_4') {
                    if (r.skor !== null) {
                        const skor = parseFloat(r.skor || 0); // skala poin, 0..bobot
                        gradedBobotFile += bobot;
                        totalNilaiFileBerbobot += skor;
                    }
                }
            });

            const skor_esai_100 = gradedBobotEsai > 0 ? Math.round((totalNilaiEsaiBerbobot / gradedBobotEsai) * 100) : 0;
            const skor_file_100 = gradedBobotFile > 0 ? Math.round((totalNilaiFileBerbobot / gradedBobotFile) * 100) : 0;

            await prisma.exam_attempts.updateMany({
                where: { user_id: response.user_id, exam_id: response.exam_id },
                data: { skor_esai_100, skor_file_100 }
            });

            // 🔒 Jika attempt ini sudah pernah diverifikasi & dipublish (SELESAI), skor komponennya
            // baru saja berubah — final_score yang sudah dipublikasikan jadi basi. Kembalikan ke
            // MENUNGGU_VERIFIKASI supaya mahasiswa tidak melihat nilai akhir yang tidak sinkron lagi,
            // dan dosen harus sadar & klik "Edit Nilai" untuk publish ulang.
            await prisma.exam_attempts.updateMany({
                where: { user_id: response.user_id, exam_id: response.exam_id, status: 'SELESAI' },
                data: { status: 'MENUNGGU_VERIFIKASI', final_score: null, verified_at: null, verified_by: null }
            });
        } catch (attemptErr) {
            console.error('❌ Gagal update exam_attempts dari manual grading:', attemptErr.message);
        }

        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan nilai." }); }
};

/**
 * BATCH RECALCULATION ENDPOINT
 * Trigger manual oleh dosen setelah verifikasi AI scores
 * Menggantikan per-soal recalculation di AI worker
 */
exports.recalculateExamScores = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak!" });
        }

        // Get all attempts for this exam
        const attempts = await prisma.exam_attempts.findMany({
            where: { exam_id: examId }
        });

        let updatedCount = 0;

        for (const attempt of attempts) {
            // Get all responses for this student + exam
            const allResponses = await prisma.student_responses.findMany({
                where: { user_id: attempt.user_id, exam_id: examId },
                include: { questions: { select: { tipe_soal: true, bobot_nilai: true } } }
            });

            let gradedBobotPilgan = 0, totalNilaiPilganBerbobot = 0;
            let gradedBobotEsai = 0, totalNilaiEsaiBerbobot = 0;
            let gradedBobotFile = 0, totalNilaiFileBerbobot = 0;

            // FIX 2026-08-22: r.skor SELALU skala POIN (0..bobot soal itu sendiri)
            // buat semua tipe soal -- Pilgan (0 atau bobot_nilai dari auto-grading),
            // Esai (dari AI, lihat aiService.js), Upload (dari submitScore manual,
            // fix di atas). Weighted-average-jadi-0-100 yang benar itu
            // Σskor / Σbobot × 100, BUKAN Σ(skor×bobot) -- itu double-counting bobot.
            allResponses.forEach(r => {
                const bobot = parseFloat(r.questions.bobot_nilai || 10);
                const skor = r.skor !== null ? parseFloat(r.skor || 0) : null;

                if (r.questions.tipe_soal === 'TIPE_1' || r.questions.tipe_soal === 'TIPE_2') {
                    if (skor !== null) {
                        gradedBobotPilgan += bobot;
                        totalNilaiPilganBerbobot += skor;
                    }
                } else if (r.questions.tipe_soal === 'TIPE_3') {
                    if (skor !== null) {
                        gradedBobotEsai += bobot;
                        totalNilaiEsaiBerbobot += skor;
                    }
                } else if (r.questions.tipe_soal === 'TIPE_4') {
                    if (skor !== null) {
                        gradedBobotFile += bobot;
                        totalNilaiFileBerbobot += skor;
                    }
                }
            });

            const skor_pilgan_100 = gradedBobotPilgan > 0 ? Math.round((totalNilaiPilganBerbobot / gradedBobotPilgan) * 100) : 0;
            const skor_esai_100 = gradedBobotEsai > 0 ? Math.round((totalNilaiEsaiBerbobot / gradedBobotEsai) * 100) : 0;
            const skor_file_100 = gradedBobotFile > 0 ? Math.round((totalNilaiFileBerbobot / gradedBobotFile) * 100) : 0;

            await prisma.exam_attempts.update({
                where: { id: attempt.id },
                data: {
                    skor_pilgan_100, skor_esai_100, skor_file_100,
                    // 🔒 Sama seperti submitScore: kalau attempt ini sudah SELESAI (final_score sudah
                    // dipublikasikan), komponen skornya baru saja berubah lewat recalculate — jangan
                    // biarkan final_score lama yang basi tetap tampil ke mahasiswa.
                    ...(attempt.status === 'SELESAI' && {
                        status: 'MENUNGGU_VERIFIKASI',
                        final_score: null,
                        verified_at: null,
                        verified_by: null
                    })
                }
            });

            updatedCount++;
        }

        res.status(200).json({
            message: `Berhasil recalculate skor untuk ${updatedCount} mahasiswa.`,
            updatedCount
        });
    } catch (error) {
        console.error("❌ ERROR RECALCULATE:", error);
        res.status(500).json({ message: "Gagal recalculate skor." });
    }
};