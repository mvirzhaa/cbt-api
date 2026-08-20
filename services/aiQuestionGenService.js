const { GoogleGenerativeAI } = require("@google/generative-ai");

// ==========================================
// 🤖 AI QUESTION GENERATION SERVICE
// Meniru pola model-fallback services/aiService.js (client, MODEL_PRIORITY,
// retry/backoff), tapi TIDAK berbagi kode dengan itu — jalur ini sinkron
// (1 request dosen = 1 call, tanpa correctionQueue) karena bukan proses
// massal seperti grading esai siswa.
// ==========================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// UPDATE 2026-08-20: 4 model lama dipensiunkan Google (404 "no longer
// available") -- diganti ke alias/model generasi terbaru yang sudah dicek
// hidup langsung lewat curl, sama seperti aiService.js.
const MODEL_PRIORITY = [
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-pro-latest"
];

let currentModelIndex = 0;

const TIPE_SCHEMA_HINT = {
    TIPE_1: `[{ "isi_soal": "...", "opsi": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." }, "kunci_jawaban": "A" }]`,
    TIPE_2: `[{ "isi_soal": "...", "opsi": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." }, "kunci_jawaban": "A,C" }]`,
    TIPE_3: `[{ "isi_soal": "...", "kunci_jawaban": "rubrik atau jawaban referensi singkat" }]`,
    TIPE_4: `[{ "isi_soal": "instruksi tugas upload yang jelas" }]`
};

const buildPrompt = ({ namaMk, cpmkDeskripsi, subCpmkDeskripsi, tipeSoal, jumlah, tingkatKesulitan }) => {
    const skema = TIPE_SCHEMA_HINT[tipeSoal];
    const konteksCpmk = subCpmkDeskripsi
        ? `Sub-CPMK acuan: "${subCpmkDeskripsi}"${cpmkDeskripsi ? ` (bagian dari CPMK: "${cpmkDeskripsi}")` : ''}`
        : (cpmkDeskripsi ? `CPMK acuan: "${cpmkDeskripsi}"` : 'Tidak ada CPMK spesifik, buat soal umum sesuai mata kuliah.');

    return `
    Kamu adalah Dosen ${namaMk || 'Teknik Informatika'} yang menyusun soal ujian.
    ${konteksCpmk}
    Tingkat kesulitan: ${tingkatKesulitan || 'sedang'}.

    TUGAS: Buat tepat ${jumlah} butir soal tipe ${tipeSoal} yang mengukur pemahaman mahasiswa terhadap acuan CPMK/Sub-CPMK di atas.

    ATURAN MUTLAK OUTPUT:
    - Keluarkan HANYA JSON array valid, tanpa markdown code-fence, tanpa teks penjelasan apapun sebelum/sesudahnya.
    - Setiap elemen array mengikuti bentuk persis: ${skema}
    - Bahasa Indonesia, isi_soal jelas dan tidak ambigu.
    `;
};

const stripCodeFence = (text) => {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return fenceMatch ? fenceMatch[1] : trimmed;
};

/**
 * Generate draft questions via Gemini.
 * @returns {Array|null} parsed array of generated questions, or null if all models/parsing fail
 */
exports.generateQuestions = async ({ namaMk, cpmkDeskripsi, subCpmkDeskripsi, tipeSoal, jumlah, tingkatKesulitan }) => {
    const prompt = buildPrompt({ namaMk, cpmkDeskripsi, subCpmkDeskripsi, tipeSoal, jumlah, tingkatKesulitan });
    const maxRetries = MODEL_PRIORITY.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const modelIndex = (currentModelIndex + attempt) % MODEL_PRIORITY.length;
        const modelName = MODEL_PRIORITY[modelIndex];

        try {
            console.log(`[AI QuestionGen] Trying model: ${modelName} (attempt ${attempt + 1}/${maxRetries})`);

            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const textResponse = result.response.text();

            const jsonText = stripCodeFence(textResponse);
            const parsed = JSON.parse(jsonText);

            if (!Array.isArray(parsed)) {
                throw new Error('Response bukan JSON array.');
            }

            currentModelIndex = modelIndex;
            console.log(`[AI QuestionGen] ✅ Success with model: ${modelName} | Generated: ${parsed.length}`);
            return parsed;

        } catch (error) {
            const errorType = error.message.includes('503') ? '503 Overload' :
                            error.message.includes('404') ? '404 Not Found' :
                            error.message.includes('429') ? '429 Rate Limit' :
                            `Parse/Unknown Error: ${error.message}`;

            console.error(`[AI QuestionGen] ❌ Model ${modelName} failed: ${errorType}`);

            if (attempt === maxRetries - 1) {
                console.error(`[AI QuestionGen] ❌ All ${maxRetries} models failed.`);
                return null;
            }

            if (error.message.includes('503') || error.message.includes('429')) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    return null;
};
