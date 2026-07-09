const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const siakadClient = require('./siakadClient');

// ==========================================
// 📤 SIAKAD PUSH QUEUE
// Mirror pola aiService.js: in-memory FIFO queue, soft limit, TTL, retry+backoff.
// ==========================================

const MAX_QUEUE_SIZE = 2000;
const QUEUE_WARNING_THRESHOLD = 1000;
const JOB_TTL_MS = 60 * 60 * 1000; // 1 jam

const pushQueue = [];
let isProcessing = false;
let rejectedJobsCount = 0;

const maxRetries = 3;

const processQueue = async () => {
    if (isProcessing || pushQueue.length === 0) return;
    isProcessing = true;

    console.log(`[SIAKAD Queue] 🚀 Mulai proses queue... Ukuran: ${pushQueue.length}`);

    while (pushQueue.length > 0) {
        const job = pushQueue.shift();

        const jobAge = Date.now() - job.createdAt;
        if (jobAge > JOB_TTL_MS) {
            console.log(`[SIAKAD Queue] ⏰ Job attempt_id=${job.attempt_id} kedaluwarsa (umur: ${Math.round(jobAge / 1000 / 60)} menit). Dilewati.`);
            try {
                await prisma.exam_attempts.update({
                    where: { id: job.attempt_id },
                    data: { siakad_sync_status: 'GAGAL', siakad_error: 'Job kedaluwarsa (TTL) sebelum diproses.' }
                });
            } catch (e) {
                console.error('[SIAKAD Queue] ❌ Gagal update status TTL:', e.message);
            }
            continue;
        }

        try {
            const result = await siakadClient.pushNilai(job);

            if (result.success) {
                await prisma.exam_attempts.update({
                    where: { id: job.attempt_id },
                    data: {
                        siakad_sync_status: 'TERKIRIM',
                        siakad_synced_at: new Date(),
                        siakad_error: null
                    }
                });
                console.log(`[SIAKAD Queue] ✅ Terkirim! attempt_id=${job.attempt_id}${result.simulated ? ' (simulasi)' : ''}`);
            } else {
                job.retryCount = (job.retryCount || 0) + 1;

                if (job.retryCount <= maxRetries) {
                    console.log(`[SIAKAD Queue] ⚠️  Retry ${job.retryCount}/${maxRetries} untuk attempt_id=${job.attempt_id}: ${result.message}`);
                    pushQueue.push(job);
                } else {
                    console.error(`[SIAKAD Queue] ❌ GAGAL FINAL attempt_id=${job.attempt_id} setelah ${maxRetries} percobaan: ${result.message}`);
                    await prisma.exam_attempts.update({
                        where: { id: job.attempt_id },
                        data: { siakad_sync_status: 'GAGAL', siakad_error: (result.message || 'Unknown error').slice(0, 255) }
                    });
                }
            }
        } catch (dbError) {
            console.error('[SIAKAD Queue] ❌ DB Error:', dbError.message);
        }

        const baseDelay = 1000;
        const retryMultiplier = (job.retryCount || 0) * 1000;
        await new Promise(resolve => setTimeout(resolve, baseDelay + retryMultiplier));
    }

    isProcessing = false;
    console.log('[SIAKAD Queue] ✅ Queue selesai diproses!');
};

/**
 * Tambah job push nilai ke queue.
 * @returns {boolean} true jika diterima, false jika ditolak (queue penuh)
 */
exports.addToQueue = (job) => {
    if (pushQueue.length >= MAX_QUEUE_SIZE) {
        rejectedJobsCount++;
        console.error(`[SIAKAD Queue] ⚠️  QUEUE PENUH! Job attempt_id=${job.attempt_id} ditolak. Total ditolak: ${rejectedJobsCount}`);
        prisma.exam_attempts.update({
            where: { id: job.attempt_id },
            data: { siakad_sync_status: 'GAGAL', siakad_error: 'Queue penuh, coba push ulang nanti.' }
        }).catch(err => console.error('[SIAKAD Queue] Gagal set status fallback:', err.message));
        return false;
    }

    if (pushQueue.length >= QUEUE_WARNING_THRESHOLD) {
        console.warn(`[SIAKAD Queue] ⚠️  Ukuran queue: ${pushQueue.length}/${MAX_QUEUE_SIZE} (WARNING)`);
    }

    pushQueue.push({ ...job, createdAt: Date.now(), retryCount: 0 });
    console.log(`[SIAKAD Queue] ➕ Job ditambahkan. Queue: ${pushQueue.length}/${MAX_QUEUE_SIZE}`);

    processQueue();

    return true;
};

exports.clearQueue = () => {
    const queueLength = pushQueue.length;
    pushQueue.length = 0;
    isProcessing = false;
    rejectedJobsCount = 0;
    console.log(`[SIAKAD Queue] 🗑️  Queue dibersihkan. ${queueLength} job dihapus.`);
    return { cleared: queueLength };
};

exports.getQueueStatus = () => {
    return {
        queueLength: pushQueue.length,
        maxQueueSize: MAX_QUEUE_SIZE,
        warningThreshold: QUEUE_WARNING_THRESHOLD,
        isProcessing,
        rejectedJobs: rejectedJobsCount,
        ttl: `${JOB_TTL_MS / 1000 / 60} minutes`
    };
};
