const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const stringSimilarity = require('string-similarity'); // 🧠 OTAK AI

// Import Controllers & Middlewares
const authController = require('./controllers/authController'); 
const upload = require('./middlewares/uploadMiddleware');
const { verifyToken, isAdmin, isDosen, isDosenOrSuperAdmin } = require('./middlewares/authMiddleware');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const ALLOWED_QUESTION_TYPES = new Set(['TIPE_1', 'TIPE_2', 'TIPE_3', 'TIPE_4']);

// Membuka akses statis agar file PDF/PPT bisa diakses langsung via URL browser
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const toPositiveInt = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const toValidDate = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const materiRoutes = require('./routes/materi');

// =========================================================================
// ⚙️ SETUP MIDDLEWARE GLOBAL
// =========================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Endpoint khusus untuk fitur LMS (Materi)
app.use('/api/materi', materiRoutes);

app.get('/', (req, res) => {
    res.json({ message: "CBT API Ready! 🚀 AI Auto-Grader & Tenant Isolation Activated." });
});

// =========================================================================
// 🔐 ROUTES: OTENTIKASI & MANAJEMEN USER (ADMIN)
// =========================================================================
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);

// 1. APPROVE: Buka Gembok Akun
app.put('/api/admin/users/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        await prisma.users.update({
            where: { id: parseInt(req.params.id) },
            data: { role: req.body.role, status_aktif: true }
        });
        res.status(200).json({ message: "Akun berhasil diaktifkan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyetujui akun." }); }
});

// 2. GET PENDING: Antrean Pendaftar Baru
app.get('/api/admin/users/pending', verifyToken, isAdmin, async (req, res) => {
    try {
        const pendingUsers = await prisma.users.findMany({
            where: { status_aktif: false }, orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ data: pendingUsers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data antrean." }); }
});

// 3. GET ACTIVE: Semua Pengguna Aktif
app.get('/api/admin/users/active', verifyToken, isAdmin, async (req, res) => {
    try {
        const activeUsers = await prisma.users.findMany({
            where: { status_aktif: true }, orderBy: { role: 'asc' }
        });
        res.status(200).json({ data: activeUsers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data pengguna." }); }
});

// 4. DELETE: Hapus Pengguna Permanen
app.delete('/api/admin/users/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await prisma.users.delete({ where: { id: parseInt(req.params.id) } });
        res.status(200).json({ message: "Akun berhasil dihapus permanen!" });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus akun." }); }
});


// =========================================================================
// 📚 ROUTES: MASTER DATA (MATA KULIAH)
// =========================================================================
app.post('/api/matakuliah', verifyToken, isAdmin, async (req, res) => {
    try {
        const { kode_mk, nama_mk, dosen_id } = req.body;
        const newMk = await prisma.mata_kuliah.create({ 
            data: { kode_mk, nama_mk, dosen_id: dosen_id ? parseInt(dosen_id) : null } 
        });
        res.status(201).json({ data: newMk });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan mata kuliah" }); }
});

app.get('/api/matakuliah', verifyToken, async (req, res) => {
    try {
        const matkul = await prisma.mata_kuliah.findMany({ include: { users: { select: { nama: true } } } });
        res.status(200).json({ data: matkul });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data mata kuliah" }); }
});

app.put('/api/matakuliah/:kode_mk', verifyToken, isAdmin, async (req, res) => {
    try {
        const updatedMk = await prisma.mata_kuliah.update({
            where: { kode_mk: req.params.kode_mk },
            data: { nama_mk: req.body.nama_mk, dosen_id: req.body.dosen_id ? parseInt(req.body.dosen_id) : null }
        });
        res.status(200).json({ message: "Update berhasil!", data: updatedMk });
    } catch (error) { res.status(500).json({ message: "Gagal mengupdate mata kuliah." }); }
});

app.delete('/api/matakuliah/:kode_mk', verifyToken, isAdmin, async (req, res) => {
    try {
        await prisma.mata_kuliah.delete({ where: { kode_mk: req.params.kode_mk } });
        res.status(200).json({ message: "Mata kuliah berhasil dihapus!" });
    } catch (error) { res.status(500).json({ message: "Gagal menghapus! Pastikan tidak terikat dengan ujian." }); }
});


// =========================================================================
// 📝 ROUTES: MANAJEMEN UJIAN & BANK SOAL (DOSEN TERISOLASI)
// =========================================================================

// 1. Tarik Daftar Ujian Dosen
app.get('/api/exams', verifyToken, isDosenOrSuperAdmin, async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: req.user.role === 'super_admin' ? {} : { kode_dosen: req.user.id.toString() },
            include: { mata_kuliah: true }, orderBy: { waktu_mulai: 'desc' }
        });
        res.status(200).json({ data: exams });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data ujian." }); }
});

// Terbitkan Ujian Baru
app.post('/api/exams', verifyToken, isDosen, async (req, res) => {
    try {
        // 🌟 Tambahkan bobot_pilgan, bobot_esai, bobot_upload di tangkapan body
        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi, bobot_pilgan, bobot_esai, bobot_upload } = req.body;
        const rawUserId = req.user && req.user.id;
        const durasiInt = toPositiveInt(durasi);
        const waktuMulaiDate = toValidDate(waktu_mulai);
        const waktuSelesaiDate = toValidDate(waktu_selesai);
        
        if (!rawUserId) return res.status(401).json({ message: "Identitas tidak ditemukan." });
        if (!isNonEmptyString(kode_mk) || !isNonEmptyString(nama_ujian) || !waktuMulaiDate || !waktuSelesaiDate || !durasiInt) {
            return res.status(400).json({ message: "Input ujian tidak valid." });
        }
        if (waktuMulaiDate >= waktuSelesaiDate) return res.status(400).json({ message: "waktu_mulai harus lebih kecil dari waktu_selesai." });

        const token_ujian = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const newExam = await prisma.exams.create({
            data: {
                kode_mk, kode_dosen: rawUserId.toString(), nama_ujian, token_ujian,
                waktu_mulai: waktuMulaiDate, waktu_selesai: waktuSelesaiDate, durasi: durasiInt,
                bobot_pilgan: parseInt(bobot_pilgan) || 0, // 🌟 SIMPAN BOBOT
                bobot_esai: parseInt(bobot_esai) || 0,     // 🌟 SIMPAN BOBOT
                bobot_upload: parseInt(bobot_upload) || 0  // 🌟 SIMPAN BOBOT
            }
        });
        res.status(201).json({ message: "Ujian berhasil diterbitkan!", data: newExam });
    } catch (error) { res.status(500).json({ message: "Gagal menerbitkan ujian." }); }
});

// EDIT Ujian (Super Safe Mode & Custom Formula)
app.put('/api/exams/:id', verifyToken, isDosenOrSuperAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ message: "ID ujian tidak valid." });

        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi, bobot_pilgan, bobot_esai, bobot_upload } = req.body;

        // 🌟 Pastikan format tanggal aman untuk Prisma
        const waktuMulaiDate = new Date(waktu_mulai);
        const waktuSelesaiDate = new Date(waktu_selesai);

        if (isNaN(waktuMulaiDate.getTime()) || isNaN(waktuSelesaiDate.getTime())) {
            return res.status(400).json({ message: "Format waktu pelaksanaan tidak valid." });
        }

        if (waktuMulaiDate >= waktuSelesaiDate) {
            return res.status(400).json({ message: "Waktu mulai harus lebih awal dari waktu selesai." });
        }

        // 🌟 Pengecekan Hak Akses (Milik Sendiri)
        const examCheck = await prisma.exams.findUnique({ where: { id } });
        if (!examCheck) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (req.user.role !== 'super_admin' && examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengedit ujian ini." });
        }

        // 🌟 Eksekusi Update ke Database
        const updatedExam = await prisma.exams.update({
            where: { id },
            data: {
                kode_mk: kode_mk,
                nama_ujian: nama_ujian,
                waktu_mulai: waktuMulaiDate,
                waktu_selesai: waktuSelesaiDate,
                durasi: parseInt(durasi) || 90,
                // Pastikan bobot yang dikirim Frontend tersimpan dengan benar
                bobot_pilgan: parseInt(bobot_pilgan) || 0,
                bobot_esai: parseInt(bobot_esai) || 0,
                bobot_upload: parseInt(bobot_upload) || 0
            }
        });

        res.status(200).json({ message: "Ujian berhasil diperbarui!", data: updatedExam });
    } catch (error) {
        // Jika masih error, pesan ini akan muncul di terminal Backend Anda!
        console.error("❌ ERROR PUT EXAM:", error); 
        res.status(500).json({ message: "Gagal memperbarui ujian di database." });
    }
});

// 3. Bank Soal (CRUD)
app.get('/api/questions', verifyToken, isDosen, async (req, res) => {
    try {
        const myExams = await prisma.exams.findMany({ where: { kode_dosen: req.user.id.toString() }, select: { id: true } });
        const myExamIds = myExams.map(e => e.id);

        const questions = await prisma.questions.findMany({ 
            where: { exam_id: { in: myExamIds } }, include: { question_options: true } 
        });

        const formattedData = questions.map(q => ({
            id: q.id, exam_id: q.exam_id, tipe_soal: q.tipe_soal, isi_soal: q.isi_soal, kunci_jawaban: q.kunci_jawaban,
            opsi_jawaban: q.tipe_soal === 'TIPE_1' ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan)) : null
        }));
        res.status(200).json({ data: formattedData });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil soal." }); }
});

app.post('/api/questions', verifyToken, isDosen, async (req, res) => {
    try {
        const { exam_id, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban } = req.body;
        const examId = toPositiveInt(exam_id);
        if (!examId || !ALLOWED_QUESTION_TYPES.has(tipe_soal) || !isNonEmptyString(isi_soal)) {
            return res.status(400).json({ message: "Input soal tidak valid." });
        }

        let parsedOpsi = null;
        if (tipe_soal === 'TIPE_1') {
            if (!isNonEmptyString(kunci_jawaban)) {
                return res.status(400).json({ message: "kunci_jawaban wajib untuk TIPE_1." });
            }
            parsedOpsi = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban || '[]');
            if (!Array.isArray(parsedOpsi) || parsedOpsi.length < 2) {
                return res.status(400).json({ message: "opsi_jawaban TIPE_1 minimal 2 pilihan." });
            }
        }

        const exam = await prisma.exams.findUnique({ where: { id: examId } });
        if (!exam) {
            return res.status(404).json({ message: "Ujian tidak ditemukan." });
        }
        if (exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menambah soal di ujian ini." });
        }

        const newQuestion = await prisma.questions.create({
            data: { exam_id: examId, cpmk: "CPMK-1", tipe_soal, isi_soal, kunci_jawaban, bobot_nilai: 10.00 }
        });

        if (tipe_soal === 'TIPE_1' && parsedOpsi) {
            const opsiData = parsedOpsi.map((teks, index) => ({
                question_id: newQuestion.id, label_pilihan: ['A', 'B', 'C', 'D'][index], teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }
        res.status(201).json({ message: "Soal sukses dibuat!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan soal." }); }
});

app.put('/api/questions/:id', verifyToken, isDosen, async (req, res) => {
    try {
        const questionId = toPositiveInt(req.params.id);
        if (!questionId) {
            return res.status(400).json({ message: "ID soal tidak valid." });
        }

        const { tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, bobot_nilai, cpmk } = req.body;
        if (tipe_soal && !ALLOWED_QUESTION_TYPES.has(tipe_soal)) {
            return res.status(400).json({ message: "tipe_soal tidak valid." });
        }
        if (isi_soal !== undefined && !isNonEmptyString(isi_soal)) {
            return res.status(400).json({ message: "isi_soal tidak valid." });
        }
        if (cpmk !== undefined && !isNonEmptyString(cpmk)) {
            return res.status(400).json({ message: "cpmk tidak valid." });
        }

        const question = await prisma.questions.findUnique({ where: { id: questionId }, include: { exams: true } });
        if (!question) {
            return res.status(404).json({ message: "Soal tidak ditemukan." });
        }
        if (question.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengubah soal ini." });
        }

        let parsedBobot = question.bobot_nilai;
        if (bobot_nilai !== undefined) {
            parsedBobot = Number.parseFloat(bobot_nilai);
            if (!Number.isFinite(parsedBobot) || parsedBobot < 0) {
                return res.status(400).json({ message: "bobot_nilai harus angka >= 0." });
            }
        }

        await prisma.questions.update({
            where: { id: questionId },
            data: {
                tipe_soal: tipe_soal || question.tipe_soal,
                isi_soal: isi_soal || question.isi_soal,
                kunci_jawaban: kunci_jawaban === undefined ? question.kunci_jawaban : kunci_jawaban,
                bobot_nilai: bobot_nilai === undefined ? question.bobot_nilai : parsedBobot,
                cpmk: cpmk || question.cpmk
            }
        });

        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            const opsiArray = Array.isArray(opsi_jawaban) ? opsi_jawaban : JSON.parse(opsi_jawaban);
            if (!Array.isArray(opsiArray) || opsiArray.length < 2) {
                return res.status(400).json({ message: "opsi_jawaban TIPE_1 minimal 2 pilihan." });
            }
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
            await prisma.question_options.createMany({
                data: opsiArray.map((teks, index) => ({
                    question_id: questionId,
                    label_pilihan: ['A', 'B', 'C', 'D'][index] || String(index + 1),
                    teks_pilihan: teks
                }))
            });
        }

        if (tipe_soal && tipe_soal !== 'TIPE_1') {
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
        }

        return res.status(200).json({ message: "Soal berhasil diperbarui." });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memperbarui soal." });
    }
});

app.delete('/api/questions/:id', verifyToken, isDosen, async (req, res) => {
    try {
        const questionId = toPositiveInt(req.params.id);
        if (!questionId) {
            return res.status(400).json({ message: "ID soal tidak valid." });
        }
        const question = await prisma.questions.findUnique({ where: { id: questionId }, include: { exams: true } });
        if (!question) return res.status(404).json({ message: "Soal tidak ditemukan." });
        if (question.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menghapus soal ini." });
        }

        await prisma.questions.delete({ where: { id: questionId } });
        res.json({ message: "Dihapus!" });
    } 
    catch (error) { res.status(500).json({ message: "Error" }); }
});


// =========================================================================
// 🎓 ROUTES: MAHASISWA & AI AUTO-GRADER
// =========================================================================

// 1. VERIFIKASI TOKEN (DIKEMBANGKAN DENGAN TOLERANSI WAKTU)
app.post('/api/student/verify-token', verifyToken, async (req, res) => {
    try {
        const { token } = req.body;
        if (!isNonEmptyString(token)) {
            return res.status(400).json({ message: "Token ujian tidak valid." });
        }

        const exam = await prisma.exams.findUnique({
            where: { token_ujian: token.toUpperCase() }, 
            include: { mata_kuliah: true, questions: { include: { question_options: true } } }
        });

        if (!exam) return res.status(404).json({ message: "Token Ujian tidak ditemukan di database." });

        // Cek Waktu Pintar
        const now = new Date();
        const waktuMulaiToleransi = new Date(new Date(exam.waktu_mulai).getTime() - (5 * 60000)); // Toleransi 5 menit awal
        
        if (now < waktuMulaiToleransi) {
            const formatJam = new Date(exam.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return res.status(403).json({ message: `Ujian belum dimulai. Sesi dibuka pukul ${formatJam} WIB.` });
        }
        if (now > new Date(exam.waktu_selesai)) {
            return res.status(403).json({ message: "Akses ditolak. Sesi ujian ini telah resmi ditutup." });
        }

        res.status(200).json({ message: "Akses Diberikan!", data: { exam: exam, questions: exam.questions } });
    } catch (error) { res.status(500).json({ message: "Gagal memverifikasi token." }); }
});

// 2. SUBMIT UJIAN & PENILAIAN AI (DENGAN SUPER DETECTOR PILGAN)
app.post('/api/student/submit-exam', verifyToken, upload.any(), async (req, res) => {
    try {
        const { exam_id } = req.body;
        let answers = req.body.answers;
        if (typeof answers === 'string') answers = JSON.parse(answers);
        answers = answers || {};

        const user_id = req.user ? req.user.id : (req.userId || 1); 

        // 🌟 WAJIB: include question_options agar AI tahu teks asli pilihan ganda
        const questions = await prisma.questions.findMany({ 
            where: { exam_id: parseInt(exam_id) },
            include: { question_options: true }
        });
        
        if (questions.length === 0) return res.status(404).json({ message: "Soal tidak ditemukan." });

        const rekamJawaban = [];
        let totalSkorDiperoleh = 0;

        for (const soal of questions) {
            const jawabanMhs = answers[soal.id.toString()] || "";
            const fileTerlampir = req.files ? req.files.find(f => f.fieldname === `file_${soal.id}`) : null;
            const pathFile = fileTerlampir ? fileTerlampir.path.replace(/\\/g, "/") : null;
            
            let skorDidapat = 0;
            let statusNilai = 'menunggu';
            const bobot = soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10.0;

            // 🤖 MESIN PENILAIAN SUPER DETECTOR
            if (soal.tipe_soal === 'TIPE_1') { 
                const jawabanMhsAman = String(jawabanMhs).trim().toUpperCase(); 
                const kunciAsli = String(soal.kunci_jawaban).trim().toUpperCase(); 
                
                const opsiDipilih = soal.question_options?.find(opt => String(opt.label_pilihan).toUpperCase() === jawabanMhsAman);

                let isCorrect = false;

                // Cek 3 Skenario Penyimpanan Data Dosen: Huruf, Angka Index, atau Teks Asli
                if (kunciAsli === jawabanMhsAman) {
                    isCorrect = true;
                } else if ((kunciAsli === "0" && jawabanMhsAman === "A") ||
                           (kunciAsli === "1" && jawabanMhsAman === "B") ||
                           (kunciAsli === "2" && jawabanMhsAman === "C") ||
                           (kunciAsli === "3" && jawabanMhsAman === "D")) {
                    isCorrect = true;
                } else if (opsiDipilih && kunciAsli === String(opsiDipilih.teks_pilihan).trim().toUpperCase()) {
                    isCorrect = true;
                }

                if (isCorrect) skorDidapat = bobot; 
                statusNilai = 'selesai';

            } else if (soal.tipe_soal === 'TIPE_3') { 
                if (jawabanMhs && soal.kunci_jawaban) {
                    const similarity = stringSimilarity.compareTwoStrings(jawabanMhs.toLowerCase(), soal.kunci_jawaban.toLowerCase());
                    skorDidapat = Math.round(similarity * bobot * 100) / 100;
                }
                statusNilai = 'selesai'; 
            } else if (soal.tipe_soal === 'TIPE_4') { 
                skorDidapat = 0; statusNilai = 'menunggu'; 
            }

            rekamJawaban.push({
                user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                jawaban_teks: jawabanMhs, file_path: pathFile, skor: skorDidapat, status_penilaian: statusNilai 
            });
            totalSkorDiperoleh += skorDidapat;
        }

        await prisma.student_responses.createMany({ data: rekamJawaban });
        res.status(200).json({ message: "Ujian direkam!", info_nilai: `Skor Otomatis: ${totalSkorDiperoleh}` });
    } catch (error) { 
        console.error("❌ ERROR SUBMIT:", error);
        res.status(500).json({ message: "Gagal menyimpan ujian ke database." }); 
    }
});

// 3. RIWAYAT UJIAN MAHASISWA
app.get('/api/student/history', verifyToken, async (req, res) => {
    try {
        const user_id = req.user ? req.user.id : req.userId;
        const responses = await prisma.student_responses.findMany({
            where: { user_id: user_id }, include: { exams: { include: { mata_kuliah: true } } }
        });

        const rekapNilai = {};
        responses.forEach(resp => {
            const exId = resp.exam_id;
            if (!rekapNilai[exId]) rekapNilai[exId] = { exam_nama: resp.exams?.nama_ujian || 'Unknown', matkul: resp.exams?.mata_kuliah?.nama_mk || '-', total_skor: 0, status: 'Selesai Dinilai' };
            rekapNilai[exId].total_skor += parseFloat(resp.skor || 0);
            if (resp.status_penilaian === 'menunggu') rekapNilai[exId].status = 'Menunggu Koreksi Dosen';
        });
        res.status(200).json({ data: Object.values(rekapNilai) });
    } catch (error) { res.status(500).json({ message: "Gagal menarik riwayat" }); }
});


// =========================================================================
// 🏆 FITUR: GRADEBOOK & KOREKSI MANUAL (DOSEN)
// =========================================================================
app.get('/api/matakuliah/:id/scores', verifyToken, isDosen, async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: { kode_mk: req.params.id, kode_dosen: req.user.id.toString() }, select: { id: true }
        });

        const examIds = exams.map(e => e.id);
        if (examIds.length === 0) return res.status(200).json({ data: [] }); 

        const responses = await prisma.student_responses.findMany({
            where: { exam_id: { in: examIds } },
            include: { users: { select: { nama: true } }, exams: { select: { nama_ujian: true } } }
        });

        const scoreMap = {};
        responses.forEach(r => {
            const key = `${r.user_id}-${r.exam_id}`;
            if (!scoreMap[key]) {
                scoreMap[key] = { nama_mahasiswa: r.users?.nama || 'Anonim', nama_ujian: r.exams?.nama_ujian || '-', total_skor: 0, status: 'Selesai' };
            }
            scoreMap[key].total_skor += parseFloat(r.skor || 0);
            if (r.status_penilaian === 'menunggu') scoreMap[key].status = 'Menunggu Koreksi';
        });

        res.status(200).json({ data: Object.values(scoreMap) });
    } catch (error) { res.status(500).json({ message: "Gagal tarik rekap" }); }
});

app.get('/api/grading/exams/:exam_id/answers', verifyToken, isDosen, async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) {
            return res.status(400).json({ message: "ID ujian tidak valid." });
        }
        const examCheck = await prisma.exams.findUnique({ where: { id: examId } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) return res.status(403).json({ message: "Akses Ditolak!" });

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: examId, status_penilaian: 'menunggu' },
            include: { users: { select: { nama: true } }, questions: { select: { isi_soal: true, tipe_soal: true } } }
        });
        res.status(200).json({ data: answers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data jawaban." }); }
});

app.put('/api/grading/responses/:response_id/score', verifyToken, isDosen, async (req, res) => {
    try {
        const responseId = toPositiveInt(req.params.response_id);
        const scoreValue = Number.parseFloat(req.body.skor);
        if (!responseId || !Number.isFinite(scoreValue) || scoreValue < 0) {
            return res.status(400).json({ message: "Input penilaian tidak valid." });
        }
        const response = await prisma.student_responses.findUnique({
            where: { id: responseId },
            include: { exams: true }
        });

        if (!response) {
            return res.status(404).json({ message: "Jawaban tidak ditemukan." });
        }
        if (response.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menilai jawaban ini." });
        }

        await prisma.student_responses.update({
            where: { id: responseId },
            data: { skor: scoreValue, status_penilaian: 'selesai' }
        });
        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan nilai." }); }
});

// =========================================================================
// 📊 ROUTE BARU: REKAP NILAI RINCI PER SESI UJIAN
// =========================================================================
// 📊 REKAP NILAI RINCI DENGAN CUSTOM FORMULA DOSEN
app.get('/api/exams/:exam_id/rekap-detail', verifyToken, isDosen, async (req, res) => {
    try {
        const examId = toPositiveInt(req.params.exam_id);
        if (!examId) return res.status(400).json({ message: "ID ujian tidak valid." });
        
        const exam = await prisma.exams.findUnique({ 
            where: { id: examId },
            include: { questions: true } // Ambil soal untuk hitung nilai maksimal
        });
        
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan." });
        if (exam.kode_dosen !== req.user.id.toString()) return res.status(403).json({ message: "Akses Ditolak!" });

        // 🧠 1. Hitung Nilai Maksimal Mentah per Kategori
        let maxPilgan = 0, maxEsai = 0, maxUpload = 0;
        exam.questions.forEach(q => {
            const bobotSoal = parseFloat(q.bobot_nilai || 10);
            if (q.tipe_soal === 'TIPE_1') maxPilgan += bobotSoal;
            else if (q.tipe_soal === 'TIPE_2' || q.tipe_soal === 'TIPE_3') maxEsai += bobotSoal;
            else if (q.tipe_soal === 'TIPE_4') maxUpload += bobotSoal;
        });

        // 2. Tarik semua jawaban mahasiswa
        const responses = await prisma.student_responses.findMany({
            where: { exam_id: examId },
            include: { users: { select: { nama: true } }, questions: { select: { tipe_soal: true } } }
        });

        const studentScores = {};

        responses.forEach(r => {
            const uid = r.user_id;
            if (!studentScores[uid]) {
                studentScores[uid] = {
                    nama_mahasiswa: r.users?.nama || 'Anonim',
                    raw_pilgan: 0, raw_esai: 0, raw_upload: 0,
                    status: 'Selesai'
                };
            }

            const tipe = r.questions?.tipe_soal;
            const skor = parseFloat(r.skor || 0);

            if (tipe === 'TIPE_1') studentScores[uid].raw_pilgan += skor;
            else if (tipe === 'TIPE_2' || tipe === 'TIPE_3') studentScores[uid].raw_esai += skor; 
            else if (tipe === 'TIPE_4') studentScores[uid].raw_upload += skor;

            if (r.status_penilaian === 'menunggu') studentScores[uid].status = 'Menunggu Koreksi Dosen';
        });

        // 🧠 3. Terapkan Rumus Persentase Dosen
        const finalResults = Object.values(studentScores).map(student => {
            // Rumus: (Skor Mentah Mahasiswa / Skor Maksimal Kategori) * Persentase Dosen
            const nilaiPilgan = maxPilgan > 0 ? (student.raw_pilgan / maxPilgan) * exam.bobot_pilgan : 0;
            const nilaiEsai = maxEsai > 0 ? (student.raw_esai / maxEsai) * exam.bobot_esai : 0;
            const nilaiUpload = maxUpload > 0 ? (student.raw_upload / maxUpload) * exam.bobot_upload : 0;

            return {
                nama_mahasiswa: student.nama_mahasiswa,
                skor_pilgan: nilaiPilgan,   // Skor Pilgan setelah dikali bobot
                skor_esai: nilaiEsai,       // Skor Esai setelah dikali bobot
                skor_upload: nilaiUpload,   // Skor Upload setelah dikali bobot
                total_skor: nilaiPilgan + nilaiEsai + nilaiUpload, // Pasti maksimal 100
                status: student.status
            };
        });

        res.status(200).json({ data: finalResults });
    } catch (error) {
        console.error("❌ ERROR GET REKAP DETAIL:", error);
        res.status(500).json({ message: "Gagal menarik rincian nilai." });
    }
});


// =========================================================================
// 🚀 START SERVER
// =========================================================================
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 CBT API Server Active`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});
