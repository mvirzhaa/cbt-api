const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');
const sebService = require('../services/sebService');

const findOwnedExam = async (req, examId) => {
    const exam = await prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) return { error: { status: 404, message: "Ujian tidak ditemukan." } };
    if (exam.kode_dosen !== req.user.id.toString() && req.user.role !== 'super_admin') {
        return { error: { status: 403, message: "Akses Ditolak! Ujian ini bukan milik Anda." } };
    }
    return { exam };
};

// ============================================================
// PUT /api/seb/exams/:exam_id/settings
// Nyalakan/matikan wajib-SEB untuk satu ujian + (re)generate config-nya.
// Password keluar WAJIB diisi saat pertama kali mengaktifkan -- SEB tanpa
// password keluar berarti TIDAK BISA DIKELUARKAN SAMA SEKALI (allowQuit
// false), bukan "boleh keluar tanpa password", jadi tidak boleh dibiarkan
// kosong dua-duanya. Save berikutnya boleh kosongkan field-nya kalau cuma
// mau pertahankan password yang sudah tersimpan (frontend tidak pernah
// dikasih balik plaintext-nya, cuma hash-nya yang disimpan).
// ============================================================
exports.setExamSebSettings = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { error, exam } = await findOwnedExam(req, examId);
        if (error) return res.status(error.status).json({ message: error.message });

        const sebRequire = !!req.body.seb_require;
        const quitPassword = isNonEmptyString(req.body.quit_password) ? req.body.quit_password : null;
        const existingHashedQuitPassword = exam.seb_config?.hashedQuitPassword || null;

        let sebConfig = exam.seb_config;
        if (sebRequire) {
            if (!quitPassword && !existingHashedQuitPassword) {
                return res.status(400).json({ message: "Password keluar SEB wajib diisi saat pertama kali mengaktifkan Wajib-SEB." });
            }
            const { normalizedConfig } = await sebService.buildExamSebConfig(exam, {
                quitPassword,
                hashedQuitPassword: existingHashedQuitPassword
            });
            sebConfig = normalizedConfig;
        }

        const updated = await prisma.exams.update({
            where: { id: examId },
            data: { seb_require: sebRequire, seb_config: sebConfig }
        });

        res.status(200).json({
            message: sebRequire ? "Ujian ini sekarang wajib pakai Safe Exam Browser." : "Wajib-SEB dimatikan untuk ujian ini.",
            data: { id: updated.id, seb_require: updated.seb_require }
        });
    } catch (error) {
        console.error('[sebController.setExamSebSettings]', error);
        res.status(500).json({ message: error.message || "Gagal mengatur konfigurasi SEB." });
    }
};

// ============================================================
// GET /api/seb/exams/:exam_id/config
// Unduh file .seb siap pakai (dosen sebarkan ke mahasiswa). Butuh
// seb_require sudah di-ON (lewat endpoint di atas) supaya config-nya ada.
// ============================================================
exports.downloadExamSebConfig = async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { error, exam } = await findOwnedExam(req, examId);
        if (error) return res.status(error.status).json({ message: error.message });

        if (!exam.seb_require || !exam.seb_config) {
            return res.status(409).json({ message: "Wajib-SEB belum diaktifkan untuk ujian ini. Aktifkan dulu lewat pengaturan SEB." });
        }

        const fileBuffer = await sebService.generateSebFileBuffer(exam);
        const safeName = exam.nama_ujian.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.seb"`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('[sebController.downloadExamSebConfig]', error);
        res.status(500).json({ message: error.message || "Gagal membuat file .seb." });
    }
};
