const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// Import Controllers
const authController = require('./controllers/authController'); 
const masterController = require('./controllers/masterController'); 
const examController = require('./controllers/examController'); 
const studentController = require('./controllers/studentController');
const gradingController = require('./controllers/gradingController');

// Import Middlewares
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

// Rute Tes Server
app.get('/', (req, res) => {
    res.json({ message: "Welcome to CBT API! 🚀 Master Data & Ujian siap digunakan." });
});


// =========================================================================
// 🔐 ROUTES: OTENTIKASI & USER (AUTH)
// =========================================================================
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);
app.put('/api/admin/users/:id/approve', verifyToken, isAdmin, authController.approveUser);


// =========================================================================
// 📚 ROUTES: MASTER DATA (MATA KULIAH & UJIAN)
// =========================================================================
app.post('/api/matakuliah', verifyToken, isAdmin, masterController.createMataKuliah);
app.get('/api/matakuliah', verifyToken, masterController.getAllMataKuliah);
// =========================================================================
// 🌟 RUTE PENERBITAN UJIAN (DIKENDALIKAN LANGSUNG OLEH PRISMA)
// =========================================================================

// 1. GET: Menarik Daftar Ujian
app.get('/api/exams', async (req, res) => {
    try {
        const exams = await prisma.exams.findMany({
            // 🌟 INI KUNCI UTAMANYA: Gandeng tabel mata_kuliah agar namanya terbawa ke React!
            include: { mata_kuliah: true }, 
            orderBy: { waktu_mulai: 'desc' }
        });
        res.status(200).json({ data: exams });
    } catch (error) {
        console.error("Error GET Exams:", error);
        res.status(500).json({ message: "Gagal mengambil data ujian." });
    }
});

// 2. POST: Menerbitkan Ujian Baru (Menyembuhkan Error mata_kuliah is missing)
app.post('/api/exams', async (req, res) => {
    try {
        const { matakuliah_id, nama_ujian, waktu_mulai, waktu_selesai, durasi } = req.body;
        
        // Buat Token Ujian Acak (6 Karakter)
        const generateToken = Math.random().toString(36).substring(2, 8).toUpperCase();

        const idMatkulAman = isNaN(parseInt(matakuliah_id)) ? matakuliah_id : parseInt(matakuliah_id);

        const newExam = await prisma.exams.create({
            data: {
                nama_ujian: nama_ujian,
                waktu_mulai: new Date(waktu_mulai),     
                waktu_selesai: new Date(waktu_selesai),
                durasi: parseInt(durasi),
                token_ujian: generateToken,
                kode_dosen: "D001", // Kunci Dosen (Sudah aman)
                
                // 🌟 JURUS CONNECT PRISMA: Menyambungkan relasi antar tabel secara resmi!
                mata_kuliah: {
                    connect: {
                        // Jika primary key di tabel matakuliah adalah 'kode_mk'
                        kode_mk: idMatkulAman 
                    }
                }
            }
        });
        
        res.status(201).json({ message: "Ujian berhasil diterbitkan!", data: newExam });
    } catch (error) {
        console.error("❌ GAGAL TERBITKAN UJIAN:", error);
        res.status(500).json({ message: "Database menolak data!", detail: error.message });
    }
});


// =========================================================================
// 📝 ROUTES: MANAJEMEN BANK SOAL (CRUD)
// =========================================================================

// 1. GET: Menarik Semua Soal
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await prisma.questions.findMany({
            include: { question_options: true }
        });

        const formattedData = questions.map(q => ({
            id: q.id,
            exam_id: q.exam_id,
            tipe_soal: q.tipe_soal, 
            isi_soal: q.isi_soal,
            kunci_jawaban: q.kunci_jawaban,
            opsi_jawaban: q.tipe_soal === 'TIPE_1' 
                ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan)) 
                : null
        }));

        res.status(200).json({ data: formattedData });
    } catch (error) {
        console.error("Error GET Questions:", error);
        res.status(500).json({ message: "Gagal mengambil soal dari database." });
    }
});

// 2. POST: Menambah Soal Baru (Bug "Kolom Tidak Dikenal" FIXED! ✅)
app.post('/api/questions', async (req, res) => {
    try {
        const { exam_id, tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban } = req.body;

        // 🌟 SIMPAN INDUK SOAL (Tanpa menyertakan opsi_jawaban di sini)
        const newQuestion = await prisma.questions.create({
            data: {
                exam_id: parseInt(exam_id) || 5,
                cpmk: "CPMK-1", 
                tipe_soal: tipe_soal, 
                isi_soal: isi_soal,
                kunci_jawaban: kunci_jawaban, // Kunci jawaban aman disimpan di induk
                bobot_nilai: 10.00
            }
        });

        // 🌟 JIKA PILGAN, SIMPAN OPSI KE TABEL RELASI (question_options)
        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            const opsiArray = JSON.parse(opsi_jawaban); 
            const opsiData = opsiArray.map((teks, index) => ({
                question_id: newQuestion.id,
                label_pilihan: ['A', 'B', 'C', 'D'][index],
                teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }

        res.status(201).json({ message: "Soal sukses masuk ke Bank Soal!" });
    } catch (error) {
        console.error("Error POST Questions:", error);
        res.status(500).json({ message: "Gagal menyimpan soal ke database." });
    }
});

// 3. PUT: Mengedit Soal & Opsi Jawaban (FIXED! ✅)
app.put('/api/questions/:id', async (req, res) => {
    try {
        const questionId = parseInt(req.params.id);
        const { tipe_soal, isi_soal, opsi_jawaban, kunci_jawaban } = req.body;
        
        const existingQuestion = await prisma.questions.findUnique({ where: { id: questionId } });
        if (!existingQuestion) {
            return res.status(404).json({ message: "Soal tidak ditemukan di database!" });
        }

        // 🌟 UPDATE INDUK SOAL
        const updatedQuestion = await prisma.questions.update({
            where: { id: questionId },
            data: {
                tipe_soal: tipe_soal,
                isi_soal: isi_soal,
                kunci_jawaban: kunci_jawaban
            }
        });

        // 🌟 JIKA PILGAN, UPDATE JUGA OPSI A, B, C, D NYA
        if (tipe_soal === 'TIPE_1' && opsi_jawaban) {
            // Hapus opsi yang lama
            await prisma.question_options.deleteMany({ where: { question_id: questionId } });
            
            // Masukkan opsi yang baru hasil editan
            const opsiArray = JSON.parse(opsi_jawaban);
            const opsiData = opsiArray.map((teks, index) => ({
                question_id: questionId,
                label_pilihan: ['A', 'B', 'C', 'D'][index],
                teks_pilihan: teks
            }));
            await prisma.question_options.createMany({ data: opsiData });
        }

        res.json({ message: "Perubahan soal berhasil disahkan!", data: updatedQuestion });
    } catch (error) {
        console.error("❌ GAGAL EDIT SOAL:", error);
        res.status(500).json({ message: "Database menolak perubahan!", detail_error: error.message });
    }
});

// 4. DELETE: Menghapus Soal
app.delete('/api/questions/:id', async (req, res) => {
    try {
        const questionId = parseInt(req.params.id);
        
        const existingQuestion = await prisma.questions.findUnique({ where: { id: questionId } });
        if (!existingQuestion) {
            return res.status(404).json({ message: "Soal tidak ditemukan!" });
        }

        await prisma.questions.delete({ where: { id: questionId } });
        res.json({ message: "Soal berhasil dihapus permanen!" });
    } catch (error) {
        console.error("Gagal menghapus soal:", error);
        res.status(500).json({ message: "Terjadi kesalahan server saat menghapus soal." });
    }
});


// =========================================================================
// 🎓 ROUTES: MAHASISWA & AUTO-GRADER
// =========================================================================
app.post('/api/student/enter-exam', verifyToken, studentController.enterExam);
app.post('/api/student/submit', verifyToken, upload.single('file_jawaban'), studentController.submitAnswer);
// =========================================================================
// 🌟 RUTE BARU: MAHASISWA VERIFIKASI TOKEN & TARIK SOAL KHUSUS
// =========================================================================
app.post('/api/student/verify-token', async (req, res) => {
    try {
        const { token_ujian } = req.body;
        
        // 1. Cari ujian berdasarkan token yang diketik mahasiswa
        const exam = await prisma.exams.findFirst({
            where: { token_ujian: token_ujian }
        });

        if (!exam) {
            return res.status(404).json({ message: "Token Ujian tidak valid atau ujian tidak ditemukan!" });
        }

        // 2. Ambil HANYA soal yang exam_id-nya cocok dengan ujian ini
        const questions = await prisma.questions.findMany({
            where: { exam_id: exam.id },
            include: { question_options: true }
        });

        // 3. Format soal agar rapi dibaca oleh React
        const formattedData = questions.map(q => ({
            id: q.id,
            exam_id: q.exam_id,
            tipe_soal: q.tipe_soal, 
            isi_soal: q.isi_soal,
            opsi_jawaban: q.tipe_soal === 'TIPE_1' 
                ? JSON.stringify(q.question_options.map(opt => opt.teks_pilihan)) 
                : null
        }));

        res.status(200).json({ 
            message: "Akses Ujian Diberikan!", 
            exam: exam,
            questions: formattedData 
        });
    } catch (error) {
        console.error("Error Verify Token:", error);
        res.status(500).json({ message: "Terjadi kesalahan sistem saat memverifikasi token." });
    }
});

app.post('/api/exams/submit', upload.any(), async (req, res) => {
    try {
        const { exam_id } = req.body;
        const answers = req.body.answers ? JSON.parse(req.body.answers) : {};
        const user_id = req.user ? req.user.id : 1; 

        console.log(`\n⚙️ [AUTO-GRADER] Mengoreksi Ujian ID: ${exam_id} untuk User ID: ${user_id}`);

        const questions = await prisma.questions.findMany({
            where: { exam_id: parseInt(exam_id) }
        });

        if (questions.length === 0) return res.status(404).json({ message: "Soal tidak ditemukan." });

        const rekamJawaban = [];
        let totalBenarPG = 0;
        let totalPG = 0;

        for (const soal of questions) {
            const jawabanMhs = answers[soal.id.toString()] || "";
            const fileTerlampir = req.files ? req.files.find(f => f.fieldname === `file_${soal.id}`) : null;
            const pathFile = fileTerlampir ? fileTerlampir.path.replace(/\\/g, "/") : null;

            if (soal.tipe_soal === 'TIPE_1') {
                totalPG++;
                let skorDidapat = 0;
                if (jawabanMhs && jawabanMhs === soal.kunci_jawaban) {
                    totalBenarPG++;
                    skorDidapat = soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10; 
                }

                rekamJawaban.push({
                    user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                    jawaban_teks: jawabanMhs, file_path: null, skor: skorDidapat, status_penilaian: 'selesai' 
                });
            } else if (soal.tipe_soal === 'TIPE_4') {
                rekamJawaban.push({
                    user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                    jawaban_teks: jawabanMhs, file_path: pathFile, 
                    skor: 0, status_penilaian: 'menunggu' 
                });
            } else {
                rekamJawaban.push({
                    user_id: user_id, exam_id: parseInt(exam_id), question_id: soal.id,
                    jawaban_teks: jawabanMhs, file_path: null, skor: 0, status_penilaian: 'menunggu' 
                });
            }
        }

        await prisma.student_responses.createMany({ data: rekamJawaban });

        let persentaseNilai = 0;
        if (totalPG > 0) persentaseNilai = Math.round((totalBenarPG / totalPG) * 100);

        console.log(`✅ [SUKSES] Koreksi Selesai. Ada File Terupload: ${req.files ? req.files.length : 0} file.`);

        res.status(200).json({
            message: "Ujian direkam!",
            data: { total_soal_pg: totalPG, jawaban_benar: totalBenarPG, nilai_pg_skala_100: persentaseNilai, info: "Esai & File menunggu penilaian dosen." }
        });

    } catch (error) {
        console.error("❌ ERROR MESIN PENILAI:", error);
        res.status(500).json({ message: "Terjadi kesalahan internal pada mesin penilai otomatis." });
    }
});


// =========================================================================
// ✍️ ROUTES: KOREKSI MANUAL (DOSEN)
// =========================================================================
app.get('/api/grading/exams/:exam_id/answers', async (req, res) => {
    try {
        const { exam_id } = req.params;
        const answers = await prisma.student_responses.findMany({
            where: {
                exam_id: parseInt(exam_id),
                status_penilaian: 'menunggu' 
            },
            include: {
                users: { select: { nama: true } },
                questions: { select: { isi_soal: true, tipe_soal: true } }
            }
        });
        res.status(200).json({ data: answers });
    } catch (error) {
        console.error("Error GET Answers:", error);
        res.status(500).json({ message: "Gagal mengambil data jawaban." });
    }
});

app.put('/api/grading/responses/:response_id/score', async (req, res) => {
    try {
        const { response_id } = req.params;
        const { skor } = req.body;

        await prisma.student_responses.update({
            where: { id: parseInt(response_id) },
            data: { skor: parseFloat(skor), status_penilaian: 'selesai' }
        });

        res.status(200).json({ message: "Nilai berhasil disimpan!" });
    } catch (error) {
        console.error("Error PUT Score:", error);
        res.status(500).json({ message: "Gagal menyimpan nilai." });
    }
});


// =========================================================================
// 🚨 JALUR BELAKANG DARURAT (BACKDOOR SUPER ADMIN)
// =========================================================================
app.get('/api/bikin-admin-darurat', async (req, res) => {
    try {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10); 
        const existingAdmin = await prisma.users.findUnique({ where: { email: 'admin@uika.ac.id' } });
        
        if (existingAdmin) {
            await prisma.users.update({
                where: { email: 'admin@uika.ac.id' },
                data: { password: hashedPassword, role: 'super_admin' }
            });
            return res.send('Akun admin@uika.ac.id berhasil di-reset! Password barunya adalah: admin123');
        } else {
            await prisma.users.create({
                data: { nama: 'Super Admin UIKA', email: 'admin@uika.ac.id', password: hashedPassword, role: 'super_admin' }
            });
            return res.send('Akun admin@uika.ac.id berhasil DIBUAT! Passwordnya adalah: admin123');
        }
    } catch (error) {
        res.send('Gagal membuat admin: ' + error.message);
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