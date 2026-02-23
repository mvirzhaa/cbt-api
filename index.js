const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const stringSimilarity = require('string-similarity'); // 🧠 OTAK AI

// Import Controllers & Middlewares
const authController = require('./controllers/authController'); 
const upload = require('./middlewares/uploadMiddleware');
const { verifyToken, isAdmin, isDosen } = require('./middlewares/authMiddleware');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// =========================================================================
// ⚙️ SETUP MIDDLEWARE GLOBAL
// =========================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

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
app.get('/api/exams', verifyToken, async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            where: req.user.role === 'super_admin' ? {} : { kode_dosen: req.user.id.toString() },
            include: { mata_kuliah: true }, orderBy: { waktu_mulai: 'desc' }
        });
        res.status(200).json({ data: exams });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data ujian." }); }
});

// 2. Terbitkan Ujian Baru
app.post('/api/exams', verifyToken, async (req, res) => {
    try {
        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi } = req.body;
        const rawUserId = req.userId || (req.user && req.user.id);
        
        if (!rawUserId) return res.status(401).json({ message: "Identitas tidak ditemukan." });

        const token_ujian = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const newExam = await prisma.exams.create({
            data: {
                kode_mk, kode_dosen: rawUserId.toString(), nama_ujian, token_ujian,
                waktu_mulai: new Date(waktu_mulai), waktu_selesai: new Date(waktu_selesai), durasi: parseInt(durasi)
            }
        });
        res.status(201).json({ message: "Ujian berhasil diterbitkan!", data: newExam });
    } catch (error) { res.status(500).json({ message: "Gagal menerbitkan ujian." }); }
});

// EDIT Ujian
app.put('/api/exams/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_mk, nama_ujian, waktu_mulai, waktu_selesai, durasi } = req.body;
        
        // Pastikan hanya pemilik ujian yang bisa edit (Keamanan Ekstra)
        const examCheck = await prisma.exams.findUnique({ where: { id: parseInt(id) } });
        if (req.user.role !== 'super_admin' && examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak mengedit ujian ini." });
        }

        const updatedExam = await prisma.exams.update({
            where: { id: parseInt(id) },
            data: {
                kode_mk, nama_ujian, 
                waktu_mulai: new Date(waktu_mulai), 
                waktu_selesai: new Date(waktu_selesai), 
                durasi: parseInt(durasi)
            }
        });
        res.status(200).json({ message: "Ujian berhasil diperbarui!", data: updatedExam });
    } catch (error) { res.status(500).json({ message: "Gagal memperbarui ujian." }); }
});

// HAPUS Ujian (Dengan Proteksi Data Relasional)
app.delete('/api/exams/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Pastikan hanya pemilik ujian yang bisa hapus
        const examCheck = await prisma.exams.findUnique({ where: { id: parseInt(id) } });
        if (req.user.role !== 'super_admin' && examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Anda tidak berhak menghapus ujian ini." });
        }

        // 🌟 BENTENG KEAMANAN: Cek apakah sudah ada jawaban mahasiswa?
        const countResponses = await prisma.student_responses.count({
            where: { exam_id: parseInt(id) }
        });

        if (countResponses > 0) {
            return res.status(400).json({ 
                message: "DITOLAK! Ujian ini tidak bisa dihapus karena sudah dikerjakan oleh mahasiswa. Biarkan waktu ujiannya habis agar pindah ke Arsip secara otomatis." 
            });
        }

        await prisma.exams.delete({ where: { id: parseInt(id) } });
        res.status(200).json({ message: "Ujian berhasil dihapus permanen." });
    } catch (error) { 
        res.status(500).json({ message: "Gagal menghapus ujian. Pastikan tidak ada soal yang terkait." }); 
    }
});

// 3. Bank Soal (CRUD)
app.get('/api/questions', verifyToken, async (req, res) => {
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

app.post('/api/questions', verifyToken, async (req, res) => {
    try {
        const { exam_id, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban } = req.body;
        const newQuestion = await prisma.questions.create({
            data: { exam_id: parseInt(exam_id), cpmk: "CPMK-1", tipe_soal, isi_soal, kunci_jawaban, bobot_nilai: 10.00 }
        });

        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            const opsiArray = JSON.parse(opsi_jawaban); 
            const opsiData = opsiArray.map((teks, index) => ({
                question_id: newQuestion.id, label_pilihan: ['A', 'B', 'C', 'D'][index], teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }
        res.status(201).json({ message: "Soal sukses dibuat!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan soal." }); }
});

app.put('/api/questions/:id', verifyToken, async (req, res) => {
    // ... Logika Put (Tetap dari kode aslimu)
});

app.delete('/api/questions/:id', verifyToken, async (req, res) => {
    try { await prisma.questions.delete({ where: { id: parseInt(req.params.id) } }); res.json({ message: "Dihapus!" }); } 
    catch (error) { res.status(500).json({ message: "Error" }); }
});


// =========================================================================
// 🎓 ROUTES: MAHASISWA & AI AUTO-GRADER
// =========================================================================

// 1. VERIFIKASI TOKEN (DIKEMBANGKAN DENGAN TOLERANSI WAKTU)
app.post('/api/student/verify-token', verifyToken, async (req, res) => {
    try {
        const { token } = req.body;

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

// 2. SUBMIT UJIAN & PENILAIAN AI (Rute disesuaikan dengan Frontend: /api/student/submit-exam)
app.post('/api/student/submit-exam', verifyToken, upload.any(), async (req, res) => {
    try {
        const { exam_id } = req.body;
        // Mendukung format JSON Object langsung maupun Stringified FormData
        let answers = req.body.answers;
        if (typeof answers === 'string') answers = JSON.parse(answers);
        answers = answers || {};

        const user_id = req.user ? req.user.id : (req.userId || 1); 

        const questions = await prisma.questions.findMany({ where: { exam_id: parseInt(exam_id) } });
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

            if (soal.tipe_soal === 'TIPE_1') { 
                if (jawabanMhs === soal.kunci_jawaban) skorDidapat = bobot; 
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
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan ujian ke database." }); }
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
app.get('/api/matakuliah/:id/scores', verifyToken, async (req, res) => {
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

app.get('/api/grading/exams/:exam_id/answers', verifyToken, async (req, res) => {
    try {
        const { exam_id } = req.params;
        const examCheck = await prisma.exams.findUnique({ where: { id: parseInt(exam_id) } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) return res.status(403).json({ message: "Akses Ditolak!" });

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: parseInt(exam_id), status_penilaian: 'menunggu' },
            include: { users: { select: { nama: true } }, questions: { select: { isi_soal: true, tipe_soal: true } } }
        });
        res.status(200).json({ data: answers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data jawaban." }); }
});

app.put('/api/grading/responses/:response_id/score', verifyToken, async (req, res) => {
    try {
        await prisma.student_responses.update({
            where: { id: parseInt(req.params.response_id) },
            data: { skor: parseFloat(req.body.skor), status_penilaian: 'selesai' }
        });
        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan nilai." }); }
});

// =========================================================================
// 📊 ROUTE BARU: REKAP NILAI RINCI PER SESI UJIAN
// =========================================================================
app.get('/api/exams/:exam_id/rekap-detail', verifyToken, async (req, res) => {
    try {
        const { exam_id } = req.params;

        // 1. Tarik semua jawaban mahasiswa khusus untuk SATU sesi ujian ini
        const responses = await prisma.student_responses.findMany({
            where: { exam_id: parseInt(exam_id) },
            include: {
                users: { select: { nama: true } },
                questions: { select: { tipe_soal: true } } // Butuh tahu ini Pilgan/Esai/Upload
            }
        });

        // 2. Mesin Pengelompokan Nilai
        const studentScores = {};

        responses.forEach(r => {
            const uid = r.user_id;
            
            // Jika mahasiswa ini belum ada di daftar, buatkan cetak birunya
            if (!studentScores[uid]) {
                studentScores[uid] = {
                    nama_mahasiswa: r.users?.nama || 'Anonim',
                    skor_pilgan: 0,
                    skor_esai: 0,
                    skor_upload: 0,
                    total_skor: 0,
                    status: 'Selesai'
                };
            }

            const tipe = r.questions?.tipe_soal;
            const skor = parseFloat(r.skor || 0);

            // 3. Pisahkan nilai berdasarkan keranjangnya masing-masing
            if (tipe === 'TIPE_1') {
                studentScores[uid].skor_pilgan += skor;
            } else if (tipe === 'TIPE_2' || tipe === 'TIPE_3') {
                studentScores[uid].skor_esai += skor; // Esai Singkat & AI masuk sini
            } else if (tipe === 'TIPE_4') {
                studentScores[uid].skor_upload += skor;
            }

            // Tambahkan ke Total Akhir
            studentScores[uid].total_skor += skor;

            // Jika ada satu saja soal yang belum dinilai dosen, ubah statusnya
            if (r.status_penilaian === 'menunggu') {
                studentScores[uid].status = 'Menunggu Koreksi Dosen';
            }
        });

        res.status(200).json({ data: Object.values(studentScores) });
    } catch (error) {
        console.error("❌ ERROR GET REKAP DETAIL:", error);
        res.status(500).json({ message: "Gagal menarik rincian nilai." });
    }
});


// =========================================================================
// 🚨 JALUR BELAKANG DARURAT
// =========================================================================
app.get('/api/bikin-admin-darurat', async (req, res) => {
    try {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10); 
        const existingAdmin = await prisma.users.findUnique({ where: { email: 'admin@uika.ac.id' } });
        
        if (existingAdmin) {
            await prisma.users.update({ where: { email: 'admin@uika.ac.id' }, data: { password: hashedPassword, role: 'super_admin' }});
            return res.send('Akun admin di-reset! Password: admin123');
        } else {
            await prisma.users.create({ data: { nama: 'Super Admin', email: 'admin@uika.ac.id', password: hashedPassword, role: 'super_admin' }});
            return res.send('Akun admin DIBUAT! Password: admin123');
        }
    } catch (error) { res.send('Gagal: ' + error.message); }
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