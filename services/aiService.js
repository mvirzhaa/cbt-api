const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Inisialisasi Otak Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Daftar model fallback (dari yang tercepat ke yang paling stabil)
// Model names verified working on 2026-05-22
const MODEL_PRIORITY = [
    "gemini-2.5-flash",           // Stable Jun 2025 (RECOMMENDED - 1M tokens)
    "gemini-2.0-flash",           // Fast & versatile
    "gemini-2.0-flash-lite",      // Lighter & faster version
    "gemini-2.5-pro"              // Most powerful (fallback)
];

// Memori Antrean (Queue)
const correctionQueue = [];
let isProcessing = false;
let currentModelIndex = 0; // Track model yang sedang dipakai

// Fungsi Menilai dengan AI (dengan retry logic)
const gradeWithAI = async (soal, kunciJawaban, jawabanMhs, retryCount = 0) => {
    const prompt = `
    Kamu adalah Dosen Teknik Informatika yang tegas tapi adil.
    Evaluasi jawaban mahasiswa.
    ${kunciJawaban ? `Fokus pada pemahaman KONSEP TEKNIS IT berdasarkan kunci jawaban berikut:\n    Kunci Jawaban Resmi: "${kunciJawaban}"` : 'Berikan penilaian berdasarkan kebenaran konsep teknis IT secara umum dari soal tersebut.'}
    Toleransi kesalahan ketik (typo), singkatan (OOP, DB, dll), atau penggunaan bahasa gaul/campuran Inggris selama makna teknisnya benar.

    Soal: "${soal}"
    Jawaban Mahasiswa: "${jawabanMhs}"

    TUGAS: Berikan nilai akurasi dari 0 sampai 100.
    ATURAN MUTLAK: Keluarkan HANYA ANGKA BULAT (contoh: 85, 0, 100). Jangan berikan teks, penjelasan, atau simbol apapun selain angka.
    `;

    const maxRetries = MODEL_PRIORITY.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const modelName = MODEL_PRIORITY[(currentModelIndex + attempt) % MODEL_PRIORITY.length];
            console.log(`[AI Worker] Mencoba model: ${modelName} (attempt ${attempt + 1}/${maxRetries})`);

            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const textResponse = result.response.text();

            // Paksa ekstrak angka saja dari jawaban AI
            const match = textResponse.match(/\d+/);
            const score = match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 0;

            console.log(`[AI Worker] ✅ Berhasil dengan model: ${modelName}`);
            // Update model yang berhasil untuk request berikutnya
            currentModelIndex = (currentModelIndex + attempt) % MODEL_PRIORITY.length;

            return score;
        } catch (error) {
            console.error(`[AI Worker] ❌ Error dengan model ${MODEL_PRIORITY[(currentModelIndex + attempt) % MODEL_PRIORITY.length]}:`, error.message);

            // Jika ini adalah attempt terakhir, return null
            if (attempt === maxRetries - 1) {
                console.error(`[AI Worker] ❌ Semua model gagal setelah ${maxRetries} percobaan`);
                return null;
            }

            // Jika 503 (overload) atau 404 (not found), tunggu sebentar lalu coba model berikutnya
            if (error.message.includes('503') || error.message.includes('404') || error.message.includes('429')) {
                console.log(`[AI Worker] ⏳ Menunggu 2 detik sebelum mencoba model berikutnya...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    return null; // Jika semua model gagal
};

// Mesin Penggerak Antrean (Background Worker)
const processQueue = async () => {
    if (isProcessing || correctionQueue.length === 0) return;
    isProcessing = true;

    console.log(`[AI Worker] Memulai koreksi... Sisa antrean: ${correctionQueue.length}`);

    while (correctionQueue.length > 0) {
        // Ambil tumpukan paling atas
        const job = correctionQueue.shift(); 
        
        try {
            console.log(`[AI Worker] Mengoreksi ID Jawaban: ${job.responseId}...`);
            const skorAI = await gradeWithAI(job.soal, job.kunciJawaban, job.jawabanMhs);
            
            if (skorAI !== null) {
                await prisma.student_responses.update({
                    where: { id: job.responseId },
                    data: {
                        skor: skorAI
                        // status_penilaian TETAP 'menunggu' agar dosen bisa memverifikasi nilai ini di halaman Grading
                    }
                });
                console.log(`[AI Worker] ✅ Selesai! ID: ${job.responseId} | Skor: ${skorAI}`);

                // 🆕 Recalculate skor_esai_100 di exam_attempts (status TETAP MENUNGGU_VERIFIKASI)
                try {
                    const allResponses = await prisma.student_responses.findMany({
                        where: { user_id: job.userId, exam_id: job.examId },
                        include: { questions: { select: { tipe_soal: true, bobot_nilai: true } } }
                    });
                    let gradedBobotEsai = 0, totalNilaiEsaiBerbobot = 0;
                    allResponses.forEach(r => {
                        // TIPE_2 sekarang pilihan ganda multiple choice, bukan esai
                        // Hanya TIPE_3 yang pakai AI (esai)
                        if (r.questions.tipe_soal === 'TIPE_3') {
                            if (r.skor !== null) {
                                const bobot = parseFloat(r.questions.bobot_nilai || 10);
                                const skor = parseFloat(r.skor || 0);
                                gradedBobotEsai += bobot;
                                totalNilaiEsaiBerbobot += (skor * bobot);
                            }
                        }
                    });
                    const skor_esai_100 = gradedBobotEsai > 0 ? Math.round(totalNilaiEsaiBerbobot / gradedBobotEsai) : 0;
                    await prisma.exam_attempts.updateMany({
                        where: { user_id: job.userId, exam_id: job.examId },
                        data: { skor_esai_100 }
                    });
                    console.log(`[AI Worker] exam_attempts skor_esai_100 updated: ${skor_esai_100}`);
                } catch (attemptErr) {
                    console.error('❌ Gagal update exam_attempts:', attemptErr.message);
                }

                // Reset retry count jika berhasil
                if (job.retryCount) delete job.retryCount;
            } else {
                // Implementasi retry dengan exponential backoff
                job.retryCount = (job.retryCount || 0) + 1;
                const maxRetries = 5;

                if (job.retryCount <= maxRetries) {
                    console.log(`[AI Worker] ⚠️ Gagal menilai ID: ${job.responseId}, retry ke-${job.retryCount}/${maxRetries}`);
                    correctionQueue.push(job); // Kembalikan ke antrean untuk retry
                } else {
                    console.error(`[AI Worker] ❌ FINAL FAIL ID: ${job.responseId} setelah ${maxRetries} percobaan. Skip.`);
                    // Optional: tandai di database bahwa AI grading gagal
                    try {
                        await prisma.student_responses.update({
                            where: { id: job.responseId },
                            data: {
                                skor: 0,
                                status_penilaian: 'menunggu' // Dosen harus nilai manual
                            }
                        });
                    } catch (e) {
                        console.error('❌ Gagal update status gagal:', e.message);
                    }
                }
            }
        } catch (dbError) {
            console.error("❌ DB Error saat update nilai AI:", dbError.message);
        }

        // JEDA dengan exponential backoff jika ada retry
        const baseDelay = 4000; // 4 detik base delay
        const retryDelay = (job.retryCount || 0) * 2000; // Tambah 2 detik per retry
        const totalDelay = baseDelay + retryDelay;

        console.log(`[AI Worker] ⏳ Menunggu ${totalDelay/1000} detik sebelum job berikutnya...`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
    }

    isProcessing = false;
    console.log(`[AI Worker] Semua antrean ujian telah selesai dikoreksi! 🎉`);
};

// Fungsi yang akan dipanggil oleh studentController
exports.addToQueue = (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    correctionQueue.push({ responseId, soal, kunciJawaban, jawabanMhs, userId, examId });
    // Bangunkan mesin jika sedang tidur
    processQueue(); 
};