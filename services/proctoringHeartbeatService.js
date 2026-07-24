const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// 💓 PROCTORING HEARTBEAT
// FE mengirim ping tiap 10 detik selama ujian berlangsung (lihat TakeExam.jsx).
// Kalau ping berhenti (mis. mahasiswa mematikan/blokir script proctoring lewat
// devtools) sweep di bawah ini otomatis mencatat pelanggaran PENGAWAS_AI_TIDAK_AKTIF.
// In-memory saja (mirror pola siakadQueueService.js) — cukup untuk mendeteksi,
// tidak perlu tabel sesi baru karena exam_attempts memang belum punya konsep
// "sedang berlangsung".
// ==========================================

const HEARTBEAT_TIMEOUT_MS = 20 * 1000; // toleransi ~2x interval ping FE (10 detik)
const SWEEP_INTERVAL_MS = 15 * 1000;

const sessions = new Map(); // key: `${user_id}:${exam_id}` -> { user_id, exam_id, lastSeen }

const keyOf = (user_id, exam_id) => `${user_id}:${exam_id}`;

exports.touch = (user_id, exam_id) => {
    sessions.set(keyOf(user_id, exam_id), { user_id, exam_id, lastSeen: Date.now() });
};

exports.stopTracking = (user_id, exam_id) => {
    sessions.delete(keyOf(user_id, exam_id));
};

const sweep = async () => {
    const now = Date.now();

    for (const [key, session] of sessions) {
        if (now - session.lastSeen <= HEARTBEAT_TIMEOUT_MS) continue;

        // Lapor sekali lalu berhenti melacak sesi ini (hindari spam ulang tiap sweep).
        sessions.delete(key);

        try {
            await prisma.exam_violations.create({
                data: {
                    user_id: session.user_id,
                    exam_id: session.exam_id,
                    jenis_pelanggaran: 'PENGAWAS_AI_TIDAK_AKTIF',
                    foto_bukti: null,
                }
            });
            console.warn(`[Proctoring Heartbeat] ⚠️  Heartbeat hilang, pelanggaran dicatat: user_id=${session.user_id} exam_id=${session.exam_id}`);
        } catch (error) {
            console.error('[Proctoring Heartbeat] ❌ Gagal mencatat pelanggaran heartbeat:', error.message);
        }
    }
};

setInterval(sweep, SWEEP_INTERVAL_MS);

exports.getActiveSessionCount = () => sessions.size;
