const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tambah Soal ke dalam Ujian (Khusus Dosen)
exports.addQuestion = async (req, res) => {
    try {
        const { exam_id, cpmk, tipe_soal, isi_soal, kunci_jawaban, bobot_nilai, pilihan_ganda } = req.body;

        // 1. Validasi Keamanan: Pastikan ujian ini benar-benar milik Dosen yang sedang login
        const exam = await prisma.exams.findUnique({ where: { id: exam_id } });
        
        if (!exam) {
            return res.status(404).json({ message: "Ujian tidak ditemukan!" });
        }
        
        // req.user.id berasal dari Token JWT Dosen
        if (exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak! Anda bukan pembuat ujian ini." });
        }

        // 2. Simpan Soal Utama ke Database
        const newQuestion = await prisma.questions.create({
            data: {
                exam_id,
                cpmk, // Indikator CPMK sesuai request dosen
                tipe_soal, // Nilainya harus: TIPE_1, TIPE_2, TIPE_3, atau TIPE_4
                isi_soal,
                kunci_jawaban, 
                bobot_nilai
            }
        });

        // 3. Logic Khusus Tipe 1 (Pilihan Ganda)
        // Jika soal adalah PG, otomatis masukkan opsi A, B, C, D ke tabel question_options
        if (tipe_soal === 'TIPE_1' && pilihan_ganda && pilihan_ganda.length > 0) {
            const optionsData = pilihan_ganda.map(opt => ({
                question_id: newQuestion.id,
                label_pilihan: opt.label,       // Contoh: "A"
                teks_pilihan: opt.teks          // Contoh: "Ibukota Indonesia adalah Jakarta"
            }));
            
            await prisma.question_options.createMany({ data: optionsData });
        }

        res.status(201).json({ 
            message: "Soal berhasil ditambahkan ke bank soal ujian!", 
            data: newQuestion 
        });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};