const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');
const siakadQueueService = require('../services/siakadQueueService');
const siakadClient = require('../services/siakadClient');

/**
 * Susun 1 job queue dari 1 exam_attempt: breakdown per soal (skor + mapping
 * ke CPMK/Sub-CPMK external_id) + nilai akhir. Soal tanpa cpmk_id/sub_cpmk_id
 * yang punya external_id (belum dipetakan / belum di-sync ke SIAKAD) diskip
 * dari breakdown — sama seperti perilaku dev tool SIAKAD sendiri, bukan
 * dianggap error.
 */
const buildJobFromAttempt = async (attempt) => {
    const responses = await prisma.student_responses.findMany({
        where: { user_id: attempt.user_id, exam_id: attempt.exam_id, skor: { not: null } },
        include: { questions: { include: { cpmk_ref: true, sub_cpmk_ref: true } } }
    });

    // FIX 2026-08-20: bobotPoin per unit breakdown itu DULU disamain sama
    // skorMaksimal soal (poin lokal CBT) -- padahal seharusnya bobot RESMI
    // Sub-CPMK/CPMK dari RPS SIAKAD (siakad_bobot_cpmk, di-cache saat target
    // di-set, lihat setExamSiakadTarget). Dua hal itu skalanya beda sama
    // sekali (mis. soal 10 poin vs Sub-CPMK cuma jatah 6.25 dari RPS) --
    // ketuker bikin total bobotPoin per komponen gampang lebih besar dari
    // bobot komponen (ditolak SIAKAD), atau distribusinya ngasal vs RPS.
    // Soal yang CPMK/Sub-CPMK-nya gak punya bobot resmi di komponen ini
    // (bobotMap[externalId] undefined -- termasuk kasus dosen salah pilih
    // Sub-CPMK yang jatahnya komponen lain, mis. UAS tapi exam-nya UTS)
    // SENGAJA di-skip dari breakdown, bukan dipaksa kirim bobot ngasal.
    const bobotMap = attempt.exams.siakad_bobot_cpmk || {};

    const withExternalId = responses
        .map(r => ({
            r,
            externalId: r.questions.sub_cpmk_ref?.external_id || r.questions.cpmk_ref?.external_id || null
        }))
        .filter(x => x.externalId && bobotMap[x.externalId] !== undefined);

    // Bobot resmi per Sub-CPMK itu TOTAL utk komponen ini (bukan per soal) --
    // kalau lebih dari 1 soal nunjuk ke Sub-CPMK yang sama, bagi rata supaya
    // jumlahnya pas balik ke angka resmi RPS pas diagregat ulang di SIAKAD.
    const countPerExternalId = {};
    withExternalId.forEach(({ externalId }) => {
        countPerExternalId[externalId] = (countPerExternalId[externalId] || 0) + 1;
    });

    const breakdown = withExternalId.map(({ r, externalId }) => {
        const skorMaksimal = parseFloat(r.questions.bobot_nilai || 0);
        const bobotResmiTotal = parseFloat(bobotMap[externalId] || 0);
        const bobotPoin = bobotResmiTotal / countPerExternalId[externalId];
        return {
            skorDiperoleh: parseFloat(r.skor || 0),
            skorMaksimal,
            pemetaanCpmk: [{ cpmkId: externalId, bobotPoin }]
        };
    });

    return {
        attempt_id: attempt.id,
        nim: attempt.users.nim,
        kelas_kuliah_id: attempt.exams.siakad_kelas_kuliah_id,
        rencana_evaluasi_id: attempt.exams.siakad_rencana_evaluasi_id,
        final_score: attempt.final_score !== null ? parseFloat(attempt.final_score) : 0,
        breakdown
    };
};

// ============================================================
// PUT /api/siakad/exams/:exam_id/target
// Set target kelas, periode & komponen (rencana evaluasi) SIAKAD untuk satu
// ujian (sekali per exam; rencana_evaluasi_id boleh menyusul belakangan
// setelah dosen lihat opsinya lewat GET /api/siakad/rencana-evaluasi)
// ============================================================
exports.setExamSiakadTarget = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { siakad_kelas_kuliah_id, siakad_periode_akademik_id, siakad_rencana_evaluasi_id } = req.body;
        if (!isNonEmptyString(siakad_kelas_kuliah_id) || !isNonEmptyString(siakad_periode_akademik_id)) {
            return res.status(400).json({ message: "siakad_kelas_kuliah_id dan siakad_periode_akademik_id wajib diisi." });
        }

        const exam = await prisma.exams.findUnique({ where: { id: examId }, include: { mata_kuliah: true } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Akses Ditolak! Ujian ini bukan milik Anda." });
        }

        const finalRencanaEvaluasiId = siakad_rencana_evaluasi_id !== undefined
            ? (isNonEmptyString(siakad_rencana_evaluasi_id) ? siakad_rencana_evaluasi_id : null)
            : exam.siakad_rencana_evaluasi_id;

        // FIX 2026-08-20: cache bobot RESMI per CPMK/Sub-CPMK (external_id ->
        // bobotCpmk) dari RPS SIAKAD komponen ini -- dipakai buildJobFromAttempt()
        // supaya bobotPoin yang dikirim ke breakdown itu bobot resmi RPS, BUKAN
        // skorMaksimal soal lokal CBT (2 hal beda skala yang sebelumnya ketuker,
        // bikin total bobotPoin per push gampang lebih besar dari bobot komponen
        // -- SIAKAD nolak, atau kalaupun lolos distribusinya jadi ngasal vs RPS).
        // Diambil ulang tiap kali target/komponen di-set/diganti (bukan sekali di
        // awal) supaya tetap akurat kalau RPS-nya direvisi di SIAKAD.
        let siakadBobotCpmk = exam.siakad_bobot_cpmk;
        if (finalRencanaEvaluasiId && exam.mata_kuliah?.siakad_id) {
            const rencanaResult = await siakadClient.getRencanaEvaluasi(exam.mata_kuliah.siakad_id, siakad_periode_akademik_id);
            if (rencanaResult.success) {
                const list = rencanaResult.data?.rencanaEvaluasi || [];
                const match = list.find(r => r.id === finalRencanaEvaluasiId);
                siakadBobotCpmk = match?.mappingBobotCpmk || null;
            } else {
                console.warn(`[SIAKAD Target] Gagal ambil bobot CPMK resmi utk exam_id=${examId}: ${rencanaResult.message}`);
            }
        } else if (!finalRencanaEvaluasiId) {
            siakadBobotCpmk = null;
        }

        const updated = await prisma.exams.update({
            where: { id: examId },
            data: {
                siakad_kelas_kuliah_id,
                siakad_periode_akademik_id,
                siakad_rencana_evaluasi_id: finalRencanaEvaluasiId,
                siakad_bobot_cpmk: siakadBobotCpmk
            }
        });

        res.status(200).json({
            message: "Target SIAKAD berhasil disimpan.",
            data: {
                siakad_kelas_kuliah_id: updated.siakad_kelas_kuliah_id,
                siakad_periode_akademik_id: updated.siakad_periode_akademik_id,
                siakad_rencana_evaluasi_id: updated.siakad_rencana_evaluasi_id,
                siakad_bobot_cpmk: updated.siakad_bobot_cpmk
            }
        });
    } catch (error) {
        console.error("❌ ERROR SET SIAKAD TARGET:", error);
        res.status(500).json({ message: "Gagal menyimpan target SIAKAD." });
    }
};

// ============================================================
// POST /api/siakad/attempts/:attempt_id/push
// Push satu nilai mahasiswa ke SIAKAD (masuk queue)
// ============================================================
exports.pushAttempt = async (req, res) => {
    try {
        const attemptId = toPositiveInt(req.params.attempt_id);
        if (!attemptId) return res.status(400).json({ message: "ID attempt tidak valid." });

        const attempt = await prisma.exam_attempts.findUnique({
            where: { id: attemptId },
            include: { exams: true, users: { select: { nim: true } } }
        });
        if (!attempt) return res.status(404).json({ message: "Data attempt tidak ditemukan." });
        if (attempt.exams.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Anda tidak berhak push attempt ini." });
        }
        if (attempt.status !== 'SELESAI') {
            return res.status(400).json({ message: "Nilai belum diverifikasi. Verifikasi & Publish dulu sebelum push ke SIAKAD." });
        }
        if (!attempt.exams.siakad_kelas_kuliah_id || !attempt.exams.siakad_periode_akademik_id) {
            return res.status(400).json({ message: "Set target kelas SIAKAD untuk ujian ini terlebih dahulu." });
        }
        if (!attempt.exams.siakad_rencana_evaluasi_id) {
            return res.status(400).json({ message: "Set rencanaEvaluasiId (komponen SIAKAD) untuk ujian ini terlebih dahulu — lihat GET /api/siakad/rencana-evaluasi." });
        }
        if (!attempt.users.nim) {
            return res.status(400).json({ message: "Mahasiswa ini belum memiliki NIM, tidak bisa disinkronkan ke SIAKAD." });
        }

        await prisma.exam_attempts.update({
            where: { id: attemptId },
            data: { siakad_sync_status: 'ANTRIAN', siakad_error: null }
        });

        const job = await buildJobFromAttempt(attempt);
        siakadQueueService.addToQueue(job);

        res.status(200).json({ message: "Nilai masuk antrian pengiriman ke SIAKAD." });
    } catch (error) {
        console.error("❌ ERROR PUSH ATTEMPT:", error);
        res.status(500).json({ message: "Gagal push nilai ke SIAKAD." });
    }
};

// ============================================================
// POST /api/siakad/exams/:exam_id/push
// Push semua attempt SELESAI pada satu ujian ke SIAKAD (bulk)
// ============================================================
exports.pushExamAttempts = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: "Akses Ditolak! Ujian ini bukan milik Anda." });
        }
        if (!exam.siakad_kelas_kuliah_id || !exam.siakad_periode_akademik_id) {
            return res.status(400).json({ message: "Set target kelas SIAKAD untuk ujian ini terlebih dahulu." });
        }
        if (!exam.siakad_rencana_evaluasi_id) {
            return res.status(400).json({ message: "Set rencanaEvaluasiId (komponen SIAKAD) untuk ujian ini terlebih dahulu — lihat GET /api/siakad/rencana-evaluasi." });
        }

        const attempts = await prisma.exam_attempts.findMany({
            where: { exam_id: examId, status: 'SELESAI' },
            include: { exams: true, users: { select: { nim: true } } }
        });

        const eligible = attempts.filter(a => a.users.nim);
        const skippedNoNim = attempts.length - eligible.length;

        await prisma.exam_attempts.updateMany({
            where: { id: { in: eligible.map(a => a.id) } },
            data: { siakad_sync_status: 'ANTRIAN', siakad_error: null }
        });

        const jobs = await Promise.all(eligible.map(buildJobFromAttempt));
        jobs.forEach(job => siakadQueueService.addToQueue(job));

        res.status(200).json({
            message: `${eligible.length} nilai masuk antrian pengiriman ke SIAKAD.${skippedNoNim > 0 ? ` ${skippedNoNim} dilewati karena mahasiswa belum punya NIM.` : ''}`,
            queued: eligible.length,
            skippedNoNim
        });
    } catch (error) {
        console.error("❌ ERROR PUSH EXAM ATTEMPTS:", error);
        res.status(500).json({ message: "Gagal push nilai ujian ke SIAKAD." });
    }
};

// ============================================================
// GET /api/siakad/rencana-evaluasi?kode_mk=&periode_id=
// Proxy Rencana Evaluasi (daftar komponen + master CPMK/Sub-CPMK) dari
// SIAKAD, supaya dosen bisa lihat rencanaEvaluasiId mana yang mau dipakai
// sebagai target sebelum PUT /exams/:exam_id/target.
// ============================================================
exports.getRencanaEvaluasi = async (req, res) => {
    try {
        const kodeMk = req.query.kode_mk;
        const periodeId = req.query.periode_id;
        if (!isNonEmptyString(kodeMk) || !isNonEmptyString(periodeId)) {
            return res.status(400).json({ message: "kode_mk dan periode_id wajib diisi." });
        }

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk: kodeMk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });
        if (!mk.siakad_id) return res.status(400).json({ message: "Mata kuliah ini belum dipetakan ke SIAKAD (mata_kuliah.siakad_id kosong)." });

        const result = await siakadClient.getRencanaEvaluasi(mk.siakad_id, periodeId);
        if (!result.success) {
            return res.status(502).json({ message: `Gagal mengambil Rencana Evaluasi dari SIAKAD: ${result.message}` });
        }

        res.status(200).json({ data: result.data });
    } catch (error) {
        console.error("❌ ERROR GET SIAKAD RENCANA EVALUASI:", error);
        res.status(500).json({ message: "Gagal mengambil Rencana Evaluasi dari SIAKAD." });
    }
};

// ============================================================
// GET /api/siakad/kelas-kuliah?kode_mk=
// FIX 2026-08-20: proxy pencarian Kelas Kuliah dari SIAKAD, sumber picker
// "Set Target SIAKAD" (RekapNilai.jsx) -- sebelumnya dosen ketik manual
// siakad_kelas_kuliah_id/siakad_periode_akademik_id dari kotak teks kosong,
// gak ada cara nemuin ID-nya dari dalam CBT. SIAKAD cuma bisa search by NAMA
// MK (bukan siakad_id/kode_mk), jadi ambil nama_mk lokal dulu dari kode_mk.
// ============================================================
exports.searchKelasKuliah = async (req, res) => {
    try {
        const kodeMk = req.query.kode_mk;
        if (!isNonEmptyString(kodeMk)) return res.status(400).json({ message: "kode_mk wajib diisi." });

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk: kodeMk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        const result = await siakadClient.searchKelasKuliah(mk.nama_mk);
        if (!result.success) {
            return res.status(502).json({ message: `Gagal mengambil daftar Kelas Kuliah dari SIAKAD: ${result.message}` });
        }

        res.status(200).json({ data: result.data });
    } catch (error) {
        console.error("❌ ERROR GET SIAKAD KELAS KULIAH:", error);
        res.status(500).json({ message: "Gagal mengambil daftar Kelas Kuliah dari SIAKAD." });
    }
};

// ============================================================
// GET /api/siakad/mata-kuliah/:kode_mk/pemetaan-cpmk
// Proxy Pemetaan CPMK (hierarki CPMK -> Sub-CPMK lengkap kode+deskripsi)
// dari SIAKAD — sumber data buat picker "pilih Sub-CPMK langsung dari
// SIAKAD" saat bikin soal, tanpa perlu bikin cpmk/sub_cpmk lokal manual
// duluan (lihat resolveCpmkFromSiakad di bawah).
// ============================================================
exports.getPemetaanCpmk = async (req, res) => {
    try {
        const kodeMk = req.params.kode_mk;
        if (!isNonEmptyString(kodeMk)) return res.status(400).json({ message: "kode_mk tidak valid." });

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk: kodeMk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });
        if (!mk.siakad_id) return res.status(400).json({ message: "Mata kuliah ini belum dipetakan ke SIAKAD (mata_kuliah.siakad_id kosong)." });

        const result = await siakadClient.getPemetaanCpmk(mk.siakad_id);
        if (!result.success) {
            return res.status(502).json({ message: `Gagal mengambil Pemetaan CPMK dari SIAKAD: ${result.message}` });
        }

        res.status(200).json({ data: result.data });
    } catch (error) {
        console.error("❌ ERROR GET SIAKAD PEMETAAN CPMK:", error);
        res.status(500).json({ message: "Gagal mengambil Pemetaan CPMK dari SIAKAD." });
    }
};

// ============================================================
// POST /api/siakad/mata-kuliah/:kode_mk/resolve-cpmk
// Auto-provision cpmk/sub_cpmk lokal dari 1 item yang dipilih dosen di
// picker Sub-CPMK SIAKAD (data dari getPemetaanCpmk di atas). Upsert by
// kode (bukan create-terus-gagal-kalau-sudah-ada), supaya dosen tidak
// perlu bikin cpmk/sub_cpmk lokal manual duluan — cukup pilih dari SIAKAD,
// row lokal dibuat/dipakai ulang di belakang layar.
// ============================================================
exports.resolveCpmkFromSiakad = async (req, res) => {
    try {
        const kodeMk = req.params.kode_mk;
        if (!isNonEmptyString(kodeMk)) return res.status(400).json({ message: "kode_mk tidak valid." });

        const { cpmk, sub_cpmk } = req.body;
        if (!cpmk || !isNonEmptyString(cpmk.kode)) {
            return res.status(400).json({ message: "cpmk.kode wajib diisi." });
        }

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk: kodeMk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        const cpmkRow = await prisma.cpmk.upsert({
            where: { kode_mk_kode_cpmk: { kode_mk: kodeMk, kode_cpmk: cpmk.kode } },
            update: {
                external_id: cpmk.external_id || undefined,
                deskripsi: isNonEmptyString(cpmk.deskripsi) ? cpmk.deskripsi : undefined
            },
            create: {
                kode_mk: kodeMk,
                kode_cpmk: cpmk.kode,
                deskripsi: isNonEmptyString(cpmk.deskripsi) ? cpmk.deskripsi : cpmk.kode,
                external_id: cpmk.external_id || null
            }
        });

        let subCpmkRow = null;
        if (sub_cpmk && isNonEmptyString(sub_cpmk.kode)) {
            subCpmkRow = await prisma.sub_cpmk.upsert({
                where: { cpmk_id_kode_sub_cpmk: { cpmk_id: cpmkRow.id, kode_sub_cpmk: sub_cpmk.kode } },
                update: {
                    external_id: sub_cpmk.external_id || undefined,
                    deskripsi: isNonEmptyString(sub_cpmk.deskripsi) ? sub_cpmk.deskripsi : undefined
                },
                create: {
                    cpmk_id: cpmkRow.id,
                    kode_sub_cpmk: sub_cpmk.kode,
                    deskripsi: isNonEmptyString(sub_cpmk.deskripsi) ? sub_cpmk.deskripsi : sub_cpmk.kode,
                    external_id: sub_cpmk.external_id || null
                }
            });
        }

        res.status(200).json({
            message: "CPMK/Sub-CPMK berhasil disiapkan.",
            data: { cpmk_id: cpmkRow.id, sub_cpmk_id: subCpmkRow ? subCpmkRow.id : null }
        });
    } catch (error) {
        if (error.code === 'P2002') {
            const isExternalIdConflict = error.meta?.target?.includes?.('external_id');
            return res.status(409).json({ message: isExternalIdConflict ? "external_id ini sudah dipakai CPMK/Sub-CPMK lain." : "Kode CPMK/Sub-CPMK ini sudah terdaftar." });
        }
        console.error("❌ ERROR RESOLVE CPMK FROM SIAKAD:", error);
        res.status(500).json({ message: "Gagal menyiapkan CPMK/Sub-CPMK dari SIAKAD." });
    }
};

// ============================================================
// GET /api/siakad/matakuliah
// Proxy pencarian mata kuliah dari SIAKAD (untuk picker di form matkul lokal)
// ============================================================
exports.searchMataKuliah = async (req, res) => {
    try {
        const size = toPositiveInt(req.query.size) || 100;
        const search = isNonEmptyString(req.query.search) ? req.query.search : undefined;

        const result = await siakadClient.searchMataKuliah({ size, search });

        if (!result.success) {
            return res.status(502).json({ message: `Gagal mengambil data mata kuliah dari SIAKAD: ${result.message}` });
        }

        res.status(200).json({ data: result.data });
    } catch (error) {
        console.error("❌ ERROR SEARCH SIAKAD MATAKULIAH:", error);
        res.status(500).json({ message: "Gagal mengambil data mata kuliah dari SIAKAD." });
    }
};
