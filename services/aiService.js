const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Inisialisasi Otak Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Memori Antrean (Queue)
const correctionQueue = [];
let isProcessing = false;

// Fungsi Menilai dengan AI
const gradeWithAI = async (soal, kunciJawaban, jawabanMhs) => {
    const prompt = `
    Kamu adalah Dosen Teknik Informatika yang tegas tapi adil.
    Evaluasi jawaban mahasiswa berdasarkan kunci jawaban berikut.
    Fokus pada pemahaman KONSEP TEKNIS IT. Toleransi kesalahan ketik (typo), singkatan (OOP, DB, dll), atau penggunaan bahasa gaul/campuran Inggris selama makna teknisnya benar.

    Soal: "${soal}"
    Kunci Jawaban Resmi: "${kunciJawaban}"
    Jawaban Mahasiswa: "${jawabanMhs}"

    TUGAS: Berikan nilai akurasi dari 0 sampai 100.
    ATURAN MUTLAK: Keluarkan HANYA ANGKA BULAT (contoh: 85, 0, 100). Jangan berikan teks, penjelasan, atau simbol apapun selain angka.
    `;

    try {
        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();
        // Paksa ekstrak angka saja dari jawaban AI
        const match = textResponse.match(/\d+/); 
        return match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 0;
    } catch (error) {
        console.error("❌ AI Error:", error.message);
        return null; // Jika AI gagal/limit, kembalikan null agar bisa diulang
    }
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
                // Simpan nilai ke database (Update status_penilaian)
                await prisma.student_responses.update({
                    where: { id: job.responseId },
                    data: {
                        skor: skorAI,
                        status_penilaian: 'selesai'
                    }
                });
                console.log(`[AI Worker] Selesai! ID: ${job.responseId} | Skor: ${skorAI}`);
            } else {
                console.log(`[AI Worker] Gagal menilai ID: ${job.responseId}, mengembalikan ke antrean.`);
                correctionQueue.push(job); // Kembalikan ke antrean jika API gagal
            }
        } catch (dbError) {
            console.error("❌ DB Error saat update nilai AI:", dbError.message);
        }

        // JEDA 4 DETIK (Sangat Krusial untuk menembus Rate Limit 15 req/menit)
        await new Promise(resolve => setTimeout(resolve, 4000));
    }

    isProcessing = false;
    console.log(`[AI Worker] Semua antrean ujian telah selesai dikoreksi! 🎉`);
};

// Fungsi yang akan dipanggil oleh studentController
exports.addToQueue = (responseId, soal, kunciJawaban, jawabanMhs) => {
    correctionQueue.push({ responseId, soal, kunciJawaban, jawabanMhs });
    // Bangunkan mesin jika sedang tidur
    processQueue(); 
};