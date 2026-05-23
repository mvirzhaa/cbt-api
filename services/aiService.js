const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================================================
// PHASE 1: QUICK FIXES - Optimized AI Service
// ============================================================================

// Inisialisasi Otak Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model priority (verified working models)
const MODEL_PRIORITY = [
    "gemini-2.5-flash",           // Stable Jun 2025 (RECOMMENDED - 1M tokens)
    "gemini-2.0-flash",           // Fast & versatile
    "gemini-2.0-flash-lite",      // Lighter & faster version
    "gemini-2.5-pro"              // Most powerful (fallback)
];

// DEBUG: Log saat module di-load
console.log("=".repeat(60));
console.log("🔧 aiService.js LOADED - Phase 1 Optimized");
console.log("Model Priority:", MODEL_PRIORITY);
console.log("=".repeat(60));

// FIX 1B: SOFT QUEUE LIMIT (prevent RAM exhaustion)
const MAX_QUEUE_SIZE = 2000;
const QUEUE_WARNING_THRESHOLD = 1000;

// In-memory queue (will be migrated to DB in Phase 2)
const correctionQueue = [];
let isProcessing = false;
let currentModelIndex = 0;
let rejectedJobsCount = 0;

// FIX 1C: TTL - Job expiry time (1 hour)
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Grade essay with AI - Robust error handling
 * @returns {number|null} Score 0-100, or null if all models fail
 */
const gradeWithAI = async (soal, kunciJawaban, jawabanMhs) => {
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

    // Try each model in priority order
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const modelIndex = (currentModelIndex + attempt) % MODEL_PRIORITY.length;
        const modelName = MODEL_PRIORITY[modelIndex];

        try {
            console.log(`[AI Worker] Trying model: ${modelName} (attempt ${attempt + 1}/${maxRetries})`);

            const model = genAI.getGenerativeModel({ model: modelName });

            // CRITICAL: Wrap generateContent in try-catch
            const result = await model.generateContent(prompt);
            const textResponse = result.response.text();

            // Extract integer score (0-100)
            const match = textResponse.match(/\d+/);
            const score = match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 0;

            console.log(`[AI Worker] ✅ Success with model: ${modelName} | Score: ${score}`);

            // Update successful model index for next request
            currentModelIndex = modelIndex;

            return score; // Success, return score

        } catch (error) {
            // ROBUST ERROR HANDLING: Don't crash, just log and try next model
            const errorType = error.message.includes('503') ? '503 Overload' :
                            error.message.includes('404') ? '404 Not Found' :
                            error.message.includes('429') ? '429 Rate Limit' :
                            'Unknown Error';

            console.error(`[AI Worker] ❌ Model ${modelName} failed: ${errorType}`);

            // Last attempt failed
            if (attempt === maxRetries - 1) {
                console.error(`[AI Worker] ❌ All ${maxRetries} models failed. Returning null for manual grading.`);
                return null;
            }

            // Wait before trying next model (backoff for rate limits)
            if (error.message.includes('503') || error.message.includes('429')) {
                console.log(`[AI Worker] ⏳ Waiting 3s before next model...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    return null; // All models failed
};

/**
 * FIX 1A: REMOVED RECALCULATION
 * Process queue without live score recalculation
 * Recalculation will be done via batch endpoint later
 */
const processQueue = async () => {
    if (isProcessing || correctionQueue.length === 0) return;
    isProcessing = true;

    console.log(`[AI Worker] 🚀 Starting queue processing... Queue size: ${correctionQueue.length}`);

    while (correctionQueue.length > 0) {
        const job = correctionQueue.shift();

        // FIX 1C: Check job expiry (TTL)
        const jobAge = Date.now() - job.createdAt;
        if (jobAge > JOB_TTL_MS) {
            console.log(`[AI Worker] ⏰ Job ${job.responseId} expired (age: ${Math.round(jobAge/1000/60)} min). Skipping.`);
            continue; // Skip expired job
        }

        try {
            console.log(`[AI Worker] Processing response ID: ${job.responseId}...`);
            const skorAI = await gradeWithAI(job.soal, job.kunciJawaban, job.jawabanMhs);

            if (skorAI !== null) {
                // SUCCESS: Update only the individual response score
                await prisma.student_responses.update({
                    where: { id: job.responseId },
                    data: {
                        skor: skorAI
                        // status_penilaian stays 'menunggu' for dosen verification
                    }
                });
                console.log(`[AI Worker] ✅ Done! ID: ${job.responseId} | Score: ${skorAI}`);

                // FIX 1A: REMOVED RECALCULATION
                // No exam_attempts update here - saves 80% DB queries
                // Recalculation will be done via batch endpoint when dosen verifies

            } else {
                // FAILURE: All models failed
                job.retryCount = (job.retryCount || 0) + 1;
                const maxRetries = 3; // Reduced from 5 for faster failure

                if (job.retryCount <= maxRetries) {
                    console.log(`[AI Worker] ⚠️  Retry ${job.retryCount}/${maxRetries} for ID: ${job.responseId}`);
                    correctionQueue.push(job); // Re-queue for retry
                } else {
                    console.error(`[AI Worker] ❌ FINAL FAIL ID: ${job.responseId} after ${maxRetries} retries.`);
                    // Set score to 0 for manual grading
                    try {
                        await prisma.student_responses.update({
                            where: { id: job.responseId },
                            data: { skor: 0, status_penilaian: 'menunggu' }
                        });
                    } catch (e) {
                        console.error('❌ Failed to set fallback score:', e.message);
                    }
                }
            }
        } catch (dbError) {
            console.error("❌ DB Error:", dbError.message);
        }

        // FIX: INCREASED DELAY from 4s to 8s (prevent Gemini 503 errors)
        const baseDelay = 8000; // 8 seconds (respects rate limit better)
        const retryMultiplier = (job.retryCount || 0) * 2000; // +2s per retry
        const totalDelay = baseDelay + retryMultiplier;

        console.log(`[AI Worker] ⏳ Waiting ${totalDelay/1000}s before next job...`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
    }

    isProcessing = false;
    console.log(`[AI Worker] ✅ Queue processing completed!`);
};

/**
 * FIX 1B: Add job to queue with SOFT LIMIT
 * @returns {boolean} true if added, false if rejected
 */
exports.addToQueue = (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    // FIX 1B: Soft limit check
    if (correctionQueue.length >= MAX_QUEUE_SIZE) {
        rejectedJobsCount++;
        console.error(`[AI Worker] ⚠️  QUEUE FULL! Rejected job ${responseId}. Total rejected: ${rejectedJobsCount}`);

        // Fallback: Set score to 0 for manual grading
        prisma.student_responses.update({
            where: { id: responseId },
            data: { skor: 0, status_penilaian: 'menunggu' }
        }).catch(err => console.error('Failed to set fallback score:', err));

        return false; // Job rejected
    }

    // Warning threshold (soft limit)
    if (correctionQueue.length >= QUEUE_WARNING_THRESHOLD) {
        console.warn(`[AI Worker] ⚠️  Queue size: ${correctionQueue.length}/${MAX_QUEUE_SIZE} (WARNING)`);
    }

    // Add job with timestamp (for TTL)
    correctionQueue.push({
        responseId,
        soal,
        kunciJawaban,
        jawabanMhs,
        userId,
        examId,
        createdAt: Date.now(), // FIX 1C: TTL timestamp
        retryCount: 0
    });

    console.log(`[AI Worker] ➕ Job added. Queue: ${correctionQueue.length}/${MAX_QUEUE_SIZE}`);

    // Trigger worker (non-blocking)
    processQueue();

    return true; // Job accepted
};

/**
 * Clear queue (for maintenance)
 */
exports.clearQueue = () => {
    const queueLength = correctionQueue.length;
    correctionQueue.length = 0;
    isProcessing = false;
    rejectedJobsCount = 0;
    console.log(`[AI Worker] 🗑️  Queue cleared. ${queueLength} jobs removed.`);
    return { cleared: queueLength };
};

/**
 * Get queue status (for monitoring)
 */
exports.getQueueStatus = () => {
    return {
        queueLength: correctionQueue.length,
        maxQueueSize: MAX_QUEUE_SIZE,
        warningThreshold: QUEUE_WARNING_THRESHOLD,
        isProcessing: isProcessing,
        rejectedJobs: rejectedJobsCount,
        currentModel: MODEL_PRIORITY[currentModelIndex],
        modelPriority: MODEL_PRIORITY,
        ttl: `${JOB_TTL_MS/1000/60} minutes`
    };
};