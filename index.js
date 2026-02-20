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
// =========================================================================
// 🔐 ROUTES: OTENTIKASI & USER (AUTH)
// =========================================================================
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);

// 🌟 PERBAIKAN 1: RUTE APPROVE (Buka Gembok status_aktif)
app.put('/api/admin/users/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body; // Menerima 'dosen' atau 'mahasiswa' dari Frontend

        await prisma.users.update({
            where: { id: userId },
            data: { 
                role: role, 
                status_aktif: true // 🔓 INI KUNCINYA: Mengubah false menjadi true!
            }
        });
        res.status(200).json({ message: "Akun berhasil diaktifkan!" });
    } catch (error) {
        console.error("❌ ERROR APPROVE:", error.message);
        res.status(500).json({ message: "Gagal menyetujui akun." });
    }
});

// 🌟 PERBAIKAN 2: TARIK ANTREAN (Cari yang status_aktif nya false)
app.get('/api/admin/users/pending', verifyToken, isAdmin, async (req, res) => {
    try {
        const pendingUsers = await prisma.users.findMany({
            where: { status_aktif: false }, // 🕵️‍♂️ Cari semua yang belum di-approve
            orderBy: { created_at: 'desc' } // Urutkan dari yang paling baru daftar
        });
        res.status(200).json({ data: pendingUsers });
    } catch (error) {
        console.error("❌ ERROR GET PENDING USERS:", error.message);
        res.status(500).json({ message: "Gagal mengambil data antrean pendaftar." });
    }
});

// 🌟 RUTE BARU 1: Tarik SEMUA Pengguna Aktif (Dosen & Mahasiswa)
app.get('/api/admin/users/active', verifyToken, isAdmin, async (req, res) => {
    try {
        const activeUsers = await prisma.users.findMany({
            where: { status_aktif: true }, // Hanya yang sudah diverifikasi
            orderBy: { role: 'asc' } // Urutkan berdasarkan jabatan
        });
        res.status(200).json({ data: activeUsers });
    } catch (error) {
        console.error("❌ ERROR GET ACTIVE USERS:", error.message);
        res.status(500).json({ message: "Gagal mengambil data pengguna aktif." });
    }
});

// 🌟 RUTE BARU 2: Palu Keadilan (Hapus Akun Permanen)
app.delete('/api/admin/users/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await prisma.users.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.status(200).json({ message: "Akun berhasil dihapus permanen!" });
    } catch (error) {
        console.error("❌ ERROR DELETE USER:", error.message);
        res.status(500).json({ message: "Gagal menghapus akun." });
    }
});

// =========================================================================
// 📚 ROUTES: MASTER DATA (MATA KULIAH & UJIAN)
// =========================================================================

// =========================================================================
// 📚 ROUTES: MASTER DATA (MATA KULIAH)
// =========================================================================

// 1. Simpan Matkul & Dosennya
app.post('/api/matakuliah', verifyToken, isAdmin, async (req, res) => {
    try {
        const { kode_mk, nama_mk, dosen_id } = req.body;
        const newMk = await prisma.mata_kuliah.create({ 
            data: { 
                kode_mk, 
                nama_mk,
                // Jika Admin memilih dosen, simpan ID-nya. Jika tidak, biarkan kosong (null)
                dosen_id: dosen_id ? parseInt(dosen_id) : null 
            } 
        });
        res.status(201).json({ data: newMk });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal menyimpan mata kuliah" });
    }
});

// 2. Tarik Daftar Matkul (Termasuk Nama Dosennya)
app.get('/api/matakuliah', verifyToken, async (req, res) => {
    try {
        const matkul = await prisma.mata_kuliah.findMany({
            include: { 
                users: { select: { nama: true } } // 🌟 Ambil nama dosen dari relasi
            }
        });
        res.status(200).json({ data: matkul });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data mata kuliah" });
    }
});

// 3. EDIT (Update) Mata Kuliah
app.put('/api/matakuliah/:kode_mk', verifyToken, isAdmin, async (req, res) => {
    try {
        const { kode_mk } = req.params;
        const { nama_mk, dosen_id } = req.body;
        
        const updatedMk = await prisma.mata_kuliah.update({
            where: { kode_mk: kode_mk },
            data: { 
                nama_mk: nama_mk,
                dosen_id: dosen_id ? parseInt(dosen_id) : null 
            }
        });
        res.status(200).json({ message: "Update berhasil!", data: updatedMk });
    } catch (error) {
        console.error("❌ ERROR UPDATE MATKUL:", error);
        res.status(500).json({ message: "Gagal mengupdate mata kuliah." });
    }
});

// 4. HAPUS Mata Kuliah
app.delete('/api/matakuliah/:kode_mk', verifyToken, isAdmin, async (req, res) => {
    try {
        const { kode_mk } = req.params;
        await prisma.mata_kuliah.delete({
            where: { kode_mk: kode_mk }
        });
        res.status(200).json({ message: "Mata kuliah berhasil dihapus!" });
    } catch (error) {
        console.error("❌ ERROR DELETE MATKUL:", error);
        res.status(500).json({ message: "Gagal menghapus! Pastikan tidak ada ujian yang masih memakai matkul ini." });
    }
});

// 2. GET Daftar Ujian (🌟 ISOLASI DOSEN)
app.get('/api/exams', verifyToken, async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            // Hanya tampilkan ujian buatan dosen yang sedang login (Atau semua jika dia Super Admin)
            where: req.user.role === 'super_admin' ? {} : { kode_dosen: req.user.id.toString() },
            include: { mata_kuliah: true }, 
            orderBy: { waktu_mulai: 'desc' }
        });
        res.status(200).json({ data: exams });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data ujian." });
    }
});

// 3. POST Terbitkan Ujian Baru
app.post('/api/exams', verifyToken, async (req, res) => {
    try {
        const { matakuliah_id, nama_ujian, waktu_mulai, waktu_selesai, durasi } = req.body;
        const generateToken = Math.random().toString(36).substring(2, 8).toUpperCase();
        const idMatkulAman = isNaN(parseInt(matakuliah_id)) ? matakuliah_id : parseInt(matakuliah_id);

        const newExam = await prisma.exams.create({
            data: {
                nama_ujian: nama_ujian,
                waktu_mulai: new Date(waktu_mulai),     
                waktu_selesai: new Date(waktu_selesai),
                durasi: parseInt(durasi),
                token_ujian: generateToken,
                kode_dosen: req.user.id.toString(), // 🌟 KTP GAIB DOSEN ASLI
                mata_kuliah: { connect: { kode_mk: idMatkulAman } }
            }
        });
        
        res.status(201).json({ message: "Ujian berhasil diterbitkan!", data: newExam });
    } catch (error) {
        res.status(500).json({ message: "Database menolak data!", detail: error.message });
    }
});


// =========================================================================
// 📝 ROUTES: MANAJEMEN BANK SOAL (CRUD TERISOLASI)
// =========================================================================
app.get('/api/questions', verifyToken, async (req, res) => {
    try {
        // 🌟 BENTENG KEAMANAN: Tarik dulu ID Ujian milik Dosen ini
        const myExams = await prisma.exams.findMany({ 
            where: { kode_dosen: req.user.id.toString() }, 
            select: { id: true } 
        });
        const myExamIds = myExams.map(e => e.id);

        const questions = await prisma.questions.findMany({ 
            where: { exam_id: { in: myExamIds } }, // Filter soal berdasarkan ujian miliknya
            include: { question_options: true } 
        });

        const formattedData = questions.map(q => ({
            id: q.id, exam_id: q.exam_id, tipe_soal: q.tipe_soal, isi_soal: q.isi_soal, kunci_jawaban: q.kunci_jawaban,
            opsi_jawaban: q.tipe_soal === 'TIPE_1' ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan)) : null
        }));
        res.status(200).json({ data: formattedData });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil soal dari database." });
    }
});

app.post('/api/questions', verifyToken, async (req, res) => {
    try {
        const { exam_id, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban } = req.body;
        if (!exam_id) return res.status(400).json({ message: "ID Ujian tidak boleh kosong!" });

        const newQuestion = await prisma.questions.create({
            data: {
                exam_id: parseInt(exam_id), 
                cpmk: "CPMK-1", 
                tipe_soal: tipe_soal, 
                isi_soal: isi_soal, 
                kunci_jawaban: kunci_jawaban, 
                bobot_nilai: 10.00
            }
        });

        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            const opsiArray = JSON.parse(opsi_jawaban); 
            const opsiData = opsiArray.map((teks, index) => ({
                question_id: newQuestion.id, label_pilihan: ['A', 'B', 'C', 'D'][index], teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }
        res.status(201).json({ message: "Soal sukses masuk ke Bank Soal!" });
    } catch (error) {
        res.status(500).json({ message: "Gagal menyimpan soal.", detail: error.message });
    }
});

app.put('/api/questions/:id', verifyToken, async (req, res) => {
    try {
        const questionId = parseInt(req.params.id);
        const { tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban, exam_id } = req.body;
        
        const updatedQuestion = await prisma.questions.update({
            where: { id: questionId }, 
            data: { tipe_soal, isi_soal, kunci_jawaban, exam_id: exam_id ? parseInt(exam_id) : undefined }
        });

        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
            const opsiArray = JSON.parse(opsi_jawaban);
            const opsiData = opsiArray.map((teks, index) => ({
                question_id: questionId, label_pilihan: ['A', 'B', 'C', 'D'][index], teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }
        res.json({ message: "Perubahan soal berhasil disahkan!", data: updatedQuestion });
    } catch (error) {
        res.status(500).json({ message: "Database menolak perubahan!" });
    }
});

app.delete('/api/questions/:id', verifyToken, async (req, res) => {
    try {
        await prisma.questions.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Soal berhasil dihapus permanen!" });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server saat menghapus soal." });
    }
});


// =========================================================================
// 🎓 ROUTES: MAHASISWA & AUTO-GRADER (TETAP SAMA 100%)
// =========================================================================

app.post('/api/student/verify-token', verifyToken, async (req, res) => {
    try {
        const { token_ujian } = req.body;
        const exam = await prisma.exams.findFirst({ where: { token_ujian: token_ujian } });
        if (!exam) return res.status(404).json({ message: "Token Ujian tidak valid!" });

        const questions = await prisma.questions.findMany({ where: { exam_id: exam.id }, include: { question_options: true } });
        const formattedData = questions.map(q => ({
            id: q.id, exam_id: q.exam_id, tipe_soal: q.tipe_soal, isi_soal: q.isi_soal,
            opsi_jawaban: q.tipe_soal === 'TIPE_1' ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan)) : null
        }));
        res.status(200).json({ message: "Akses Diberikan!", exam: exam, questions: formattedData });
    } catch (error) { res.status(500).json({ message: "Gagal memverifikasi token." }); }
});

app.post('/api/exams/submit', verifyToken, upload.any(), async (req, res) => {
    try {
        const { exam_id } = req.body;
        const answers = req.body.answers ? JSON.parse(req.body.answers) : {};
        const user_id = req.user ? req.user.id : 1; 

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
                user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                jawaban_teks: jawabanMhs, file_path: pathFile, skor: skorDidapat, status_penilaian: statusNilai 
            });
            totalSkorDiperoleh += skorDidapat;
        }

        await prisma.student_responses.createMany({ data: rekamJawaban });
        res.status(200).json({ message: "Ujian direkam!", info_nilai: `Skor: ${totalSkorDiperoleh}` });
    } catch (error) { res.status(500).json({ message: "Gagal submit." }); }
});

app.get('/api/student/history', verifyToken, async (req, res) => {
    try {
        const user_id = req.user ? req.user.id : 1;
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
    } catch (error) { res.status(500).json({ message: "Gagal history" }); }
});


// =========================================================================
// 🏆 FITUR: GRADEBOOK PER MATKUL (ISOLASI DOSEN)
// =========================================================================
app.get('/api/matakuliah/:id/scores', verifyToken, async (req, res) => {
    try {
        const mkId = req.params.id; 
        
        // 🌟 BENTENG KEAMANAN: Cari ujian di matkul ini yang MILIK DOSEN INI SAJA
        const exams = await prisma.exams.findMany({
            where: { kode_mk: mkId, kode_dosen: req.user.id.toString() }, 
            select: { id: true }
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


// =========================================================================
// ✍️ ROUTES: KOREKSI MANUAL (ISOLASI DOSEN)
// =========================================================================
app.get('/api/grading/exams/:exam_id/answers', verifyToken, async (req, res) => {
    try {
        const { exam_id } = req.params;
        
        // 🌟 BENTENG KEAMANAN: Cek apakah ujian ini miliknya?
        const examCheck = await prisma.exams.findUnique({ where: { id: parseInt(exam_id) } });
        if (!examCheck || examCheck.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak! Anda tidak berhak." });
        }

        const answers = await prisma.student_responses.findMany({
            where: { exam_id: parseInt(exam_id), status_penilaian: 'menunggu' },
            include: { users: { select: { nama: true } }, questions: { select: { isi_soal: true, tipe_soal: true } } }
        });
        res.status(200).json({ data: answers });
    } catch (error) { res.status(500).json({ message: "Gagal mengambil data jawaban." }); }
});

app.put('/api/grading/responses/:response_id/score', verifyToken, async (req, res) => {
    try {
        const { response_id } = req.params;
        const { skor } = req.body;
        await prisma.student_responses.update({
            where: { id: parseInt(response_id) },
            data: { skor: parseFloat(skor), status_penilaian: 'selesai' }
        });
        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) { res.status(500).json({ message: "Gagal menyimpan nilai." }); }
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