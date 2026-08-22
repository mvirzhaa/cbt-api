const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toPositiveInt, isNonEmptyString } = require('../utils/helpers');
const aiQuestionGenService = require('../services/aiQuestionGenService');

const ALLOWED_QUESTION_TYPES = new Set(['TIPE_1', 'TIPE_2', 'TIPE_3', 'TIPE_4']);
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

exports.getBankSoal = async (req, res) => {
    try {
        const { kode_mk, sub_cpmk_id, tipe_soal } = req.query;
        if (!isNonEmptyString(kode_mk)) return res.status(400).json({ message: "kode_mk wajib diisi." });

        const where = { kode_mk };
        const subCpmkId = toPositiveInt(sub_cpmk_id);
        if (subCpmkId) where.sub_cpmk_id = subCpmkId;
        if (tipe_soal && ALLOWED_QUESTION_TYPES.has(tipe_soal)) where.tipe_soal = tipe_soal;

        const data = await prisma.question_bank.findMany({
            where,
            include: { options: true, cpmk: true, sub_cpmk: true },
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ data });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil bank soal." }); }
};

const parseOpsiPayload = (opsi_jawaban) => {
    if (!opsi_jawaban) return null;
    const parsed = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban || '[]');
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    return parsed;
};

exports.createBankSoal = async (req, res) => {
    try {
        const { kode_mk, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, bobot_nilai, cpmk_id, sub_cpmk_id } = req.body;

        if (!isNonEmptyString(kode_mk)) return res.status(400).json({ message: "kode_mk wajib diisi." });
        if (!ALLOWED_QUESTION_TYPES.has(tipe_soal)) return res.status(400).json({ message: "tipe_soal tidak valid." });
        if (!isNonEmptyString(isi_soal)) return res.status(400).json({ message: "isi_soal wajib diisi." });

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        let parsedOpsi = null;
        if (tipe_soal === 'TIPE_1' || tipe_soal === 'TIPE_2') {
            if (!isNonEmptyString(kunci_jawaban)) return res.status(400).json({ message: "kunci_jawaban wajib untuk tipe soal ini." });
            parsedOpsi = parseOpsiPayload(opsi_jawaban);
            if (!parsedOpsi) return res.status(400).json({ message: "opsi_jawaban minimal 2 pilihan." });
        }

        let parsedBobot = 10.00;
        if (bobot_nilai !== undefined) {
            parsedBobot = Number.parseFloat(bobot_nilai);
            if (!Number.isFinite(parsedBobot) || parsedBobot < 0) return res.status(400).json({ message: "bobot_nilai harus angka >= 0." });
        }

        const cpmkId = toPositiveInt(cpmk_id);
        const subCpmkId = toPositiveInt(sub_cpmk_id);

        const newBankSoal = await prisma.question_bank.create({
            data: {
                kode_mk,
                dibuat_oleh: req.user.id.toString(),
                tipe_soal,
                isi_soal,
                kunci_jawaban: kunci_jawaban || null,
                bobot_nilai: parsedBobot,
                cpmk_id: cpmkId || null,
                sub_cpmk_id: subCpmkId || null,
                options: parsedOpsi ? {
                    create: parsedOpsi.map((teks, index) => ({ label_pilihan: OPTION_LABELS[index], teks_pilihan: teks }))
                } : undefined
            }
        });

        res.status(201).json({ message: "Soal masuk ke Bank Soal!", data: newBankSoal });
    } catch (error) {
        console.error('[createBankSoal] Error:', error.message);
        res.status(500).json({ message: "Gagal menyimpan bank soal." });
    }
};

exports.updateBankSoal = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID bank soal tidak valid." });

        const existing = await prisma.question_bank.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Bank soal tidak ditemukan." });
        if (existing.dibuat_oleh !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengubah bank soal ini." });
        }

        const { tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, bobot_nilai, cpmk_id, sub_cpmk_id } = req.body;
        if (tipe_soal && !ALLOWED_QUESTION_TYPES.has(tipe_soal)) return res.status(400).json({ message: "tipe_soal tidak valid." });
        if (isi_soal !== undefined && !isNonEmptyString(isi_soal)) return res.status(400).json({ message: "isi_soal tidak valid." });

        let parsedBobot = existing.bobot_nilai;
        if (bobot_nilai !== undefined) {
            parsedBobot = Number.parseFloat(bobot_nilai);
            if (!Number.isFinite(parsedBobot) || parsedBobot < 0) return res.status(400).json({ message: "bobot_nilai harus angka >= 0." });
        }

        const effectiveTipe = tipe_soal || existing.tipe_soal;

        await prisma.question_bank.update({
            where: { id },
            data: {
                tipe_soal: effectiveTipe,
                isi_soal: isi_soal || existing.isi_soal,
                kunci_jawaban: kunci_jawaban === undefined ? existing.kunci_jawaban : kunci_jawaban,
                bobot_nilai: parsedBobot,
                cpmk_id: cpmk_id === undefined ? existing.cpmk_id : (toPositiveInt(cpmk_id) || null),
                sub_cpmk_id: sub_cpmk_id === undefined ? existing.sub_cpmk_id : (toPositiveInt(sub_cpmk_id) || null)
            }
        });

        if ((effectiveTipe === 'TIPE_1' || effectiveTipe === 'TIPE_2') && opsi_jawaban) {
            const parsedOpsi = parseOpsiPayload(opsi_jawaban);
            if (!parsedOpsi) return res.status(400).json({ message: "opsi_jawaban minimal 2 pilihan." });

            await prisma.question_bank_options.deleteMany({ where: { question_bank_id: id } });
            await prisma.question_bank_options.createMany({
                data: parsedOpsi.map((teks, index) => ({ question_bank_id: id, label_pilihan: OPTION_LABELS[index], teks_pilihan: teks }))
            });
        } else if (effectiveTipe === 'TIPE_3' || effectiveTipe === 'TIPE_4') {
            await prisma.question_bank_options.deleteMany({ where: { question_bank_id: id } });
        }

        res.status(200).json({ message: "Bank soal berhasil diperbarui." });
    } catch (error) { res.status(500).json({ message: "Gagal memperbarui bank soal." }); }
};

exports.deleteBankSoal = async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID bank soal tidak valid." });

        const existing = await prisma.question_bank.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Bank soal tidak ditemukan." });
        if (existing.dibuat_oleh !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menghapus bank soal ini." });
        }

        await prisma.question_bank.delete({ where: { id } });
        res.status(200).json({ message: "Bank soal dihapus." });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus bank soal." }); }
};

// ==========================================
// 📥 IMPORT KE EXAM (COPY, bukan reference)
// ==========================================
exports.importFromBank = async (req, res) => {
    try {
        const examId = toPositiveInt(req.body.exam_id);
        const bankIds = Array.isArray(req.body.bank_ids) ? req.body.bank_ids.map(toPositiveInt).filter(Boolean) : [];

        if (!examId) return res.status(400).json({ message: "exam_id tidak valid." });
        if (bankIds.length === 0) return res.status(400).json({ message: "bank_ids wajib diisi (minimal 1)." });

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menambah soal di ujian ini." });
        }

        const bankItems = await prisma.question_bank.findMany({
            where: { id: { in: bankIds } },
            include: { options: true, cpmk: true, sub_cpmk: true }
        });

        const invalidMk = bankItems.find(b => b.kode_mk !== exam.kode_mk);
        if (invalidMk) {
            return res.status(400).json({ message: `Bank soal #${invalidMk.id} bukan untuk mata kuliah ujian ini.` });
        }

        const created = [];
        for (const bank of bankItems) {
            const cpmkLabel = bank.sub_cpmk?.kode_sub_cpmk || bank.cpmk?.kode_cpmk || 'CPMK-1';
            const newQuestion = await prisma.questions.create({
                data: {
                    exam_id: examId,
                    cpmk: cpmkLabel,
                    cpmk_id: bank.cpmk_id,
                    sub_cpmk_id: bank.sub_cpmk_id,
                    tipe_soal: bank.tipe_soal,
                    isi_soal: bank.isi_soal,
                    kunci_jawaban: bank.kunci_jawaban,
                    bobot_nilai: bank.bobot_nilai,
                    question_options: bank.options.length > 0 ? {
                        create: bank.options.map(opt => ({ label_pilihan: opt.label_pilihan, teks_pilihan: opt.teks_pilihan }))
                    } : undefined
                }
            });
            created.push(newQuestion.id);
        }

        res.status(201).json({ message: `${created.length} soal berhasil diimpor ke ujian.`, question_ids: created });
    } catch (error) {
        console.error('[importFromBank] Error:', error.message);
        res.status(500).json({ message: "Gagal mengimpor soal dari bank." });
    }
};

// ==========================================
// 🤖 GENERATE SOAL VIA AI
// ==========================================
exports.generateAI = async (req, res) => {
    try {
        const { kode_mk, cpmk_id, sub_cpmk_id, tipe_soal, tingkat_kesulitan, jenis_evaluasi } = req.body;
        const jumlah = toPositiveInt(req.body.jumlah);

        if (!isNonEmptyString(kode_mk)) return res.status(400).json({ message: "kode_mk wajib diisi." });
        if (!ALLOWED_QUESTION_TYPES.has(tipe_soal)) return res.status(400).json({ message: "tipe_soal tidak valid." });
        if (!jumlah || jumlah < 1 || jumlah > 10) return res.status(400).json({ message: "jumlah harus antara 1-10." });

        const mk = await prisma.mata_kuliah.findUnique({ where: { kode_mk } });
        if (!mk) return res.status(404).json({ message: "Mata kuliah tidak ditemukan." });

        const subCpmkId = toPositiveInt(sub_cpmk_id);
        const cpmkId = toPositiveInt(cpmk_id);
        const jenisEvaluasi = isNonEmptyString(jenis_evaluasi) ? jenis_evaluasi : undefined;

        // batch = daftar { subCpmk, cpmk, jumlah } yang masing2 jadi 1 panggilan
        // AI terpisah. Kalau dosen pilih Sub-CPMK/CPMK spesifik: 1 batch aja
        // (perilaku lama, gak berubah). Kalau dikosongin: auto-bagi rata SEMUA
        // soal yang diminta ke SELURUH Sub-CPMK matkul ini, round-robin
        // berurutan (soal ke-i -> Sub-CPMK ke-(i % jumlahSub)) -- supaya tiap
        // soal AI selalu punya mapping CPMK yang jelas (penting buat OBE di
        // NL-SIAK), bukan nge-generate soal "nyasar" tanpa CPMK sama sekali.
        let batch;
        if (subCpmkId) {
            const subCpmk = await prisma.sub_cpmk.findUnique({ where: { id: subCpmkId }, include: { cpmk: true } });
            if (!subCpmk) return res.status(404).json({ message: "Sub-CPMK tidak ditemukan." });
            batch = [{ subCpmk, cpmk: subCpmk.cpmk, jumlah }];
        } else if (cpmkId) {
            const cpmk = await prisma.cpmk.findUnique({ where: { id: cpmkId } });
            if (!cpmk) return res.status(404).json({ message: "CPMK tidak ditemukan." });
            batch = [{ subCpmk: null, cpmk, jumlah }];
        } else {
            const semuaCpmk = await prisma.cpmk.findMany({
                where: { kode_mk },
                include: { sub_cpmk: { orderBy: { id: 'asc' } } },
                orderBy: { id: 'asc' }
            });
            const semuaSubCpmk = semuaCpmk.flatMap(c => c.sub_cpmk.map(sc => ({ subCpmk: sc, cpmk: c })));

            if (semuaSubCpmk.length === 0) {
                batch = [{ subCpmk: null, cpmk: null, jumlah }];
            } else {
                const jumlahPerSub = new Map();
                for (let i = 0; i < jumlah; i++) {
                    const target = semuaSubCpmk[i % semuaSubCpmk.length];
                    jumlahPerSub.set(target, (jumlahPerSub.get(target) || 0) + 1);
                }
                batch = semuaSubCpmk
                    .filter(s => jumlahPerSub.has(s))
                    .map(s => ({ subCpmk: s.subCpmk, cpmk: s.cpmk, jumlah: jumlahPerSub.get(s) }));
            }
        }

        const hasilBatch = await Promise.all(batch.map(async ({ subCpmk, cpmk, jumlah: jumlahUnit }) => {
            const generated = await aiQuestionGenService.generateQuestions({
                namaMk: mk.nama_mk,
                cpmkDeskripsi: cpmk?.deskripsi,
                subCpmkDeskripsi: subCpmk?.deskripsi,
                tipeSoal: tipe_soal,
                jumlah: jumlahUnit,
                tingkatKesulitan: tingkat_kesulitan,
                jenisEvaluasi
            });
            return { subCpmk, cpmk, generated: generated || [] };
        }));

        const gagal = hasilBatch.filter(h => h.generated.length === 0).map(h => h.subCpmk?.kode_sub_cpmk || h.cpmk?.kode_cpmk || 'umum');

        const saved = [];
        for (const { subCpmk, cpmk, generated } of hasilBatch) {
            for (const item of generated) {
                if (!isNonEmptyString(item.isi_soal)) continue;

                let optionsCreate;
                if ((tipe_soal === 'TIPE_1' || tipe_soal === 'TIPE_2') && item.opsi) {
                    optionsCreate = OPTION_LABELS
                        .filter(label => isNonEmptyString(item.opsi[label]))
                        .map(label => ({ label_pilihan: label, teks_pilihan: item.opsi[label] }));
                }

                const newBankSoal = await prisma.question_bank.create({
                    data: {
                        kode_mk,
                        dibuat_oleh: req.user.id.toString(),
                        tipe_soal,
                        isi_soal: item.isi_soal,
                        kunci_jawaban: item.kunci_jawaban || null,
                        bobot_nilai: 10.00,
                        sumber: 'AI_GENERATED',
                        cpmk_id: cpmk?.id || null,
                        sub_cpmk_id: subCpmk?.id || null,
                        options: optionsCreate && optionsCreate.length > 0 ? { create: optionsCreate } : undefined
                    },
                    include: { options: true }
                });
                saved.push(newBankSoal);
            }
        }

        if (saved.length === 0) {
            return res.status(502).json({ message: "AI gagal menghasilkan soal. Coba lagi beberapa saat, atau periksa konfigurasi GEMINI_API_KEY." });
        }

        const pesanGagal = gagal.length > 0 ? ` (${gagal.length} Sub-CPMK gagal digenerate, coba lagi: ${gagal.join(', ')})` : '';
        res.status(201).json({ message: `${saved.length} soal berhasil digenerate AI.${pesanGagal} Silakan review sebelum digunakan.`, data: saved });
    } catch (error) {
        console.error('[generateAI] Error:', error.message);
        res.status(500).json({ message: "Gagal generate soal via AI." });
    }
};
