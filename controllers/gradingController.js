const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Dosen Melihat Daftar Jawaban Mahasiswa (Filter by Ujian)
exports.getStudentAnswers = async (req, res) => {
    try {
        const { exam_id } = req.params;

        // Validasi keamanan: Pastikan ujian ini milik dosen yang sedang login
        const exam = await prisma.exams.findUnique({ where: { id: parseInt(exam_id) } });
        if (!exam) return res.status(404).json({ message: "Ujian tidak ditemukan!" });
        if (exam.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak! Anda bukan pengawas ujian ini." });
        }

        // Ambil semua jawaban yang masuk untuk ujian ini
        const answers = await prisma.student_responses.findMany({
            where: { exam_id: parseInt(exam_id) },
            include: {
                users: { select: { nama: true, email: true } }, // Intip nama mahasiswa
                questions: { select: { cpmk: true, tipe_soal: true, isi_soal: true } } // Intip isi soalnya
            }
        });

        res.json({ message: "Data jawaban berhasil diambil", data: answers });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};

// 2. Dosen Memberikan Nilai Manual (Khusus Soal Tipe 4 / Esai)
exports.giveManualScore = async (req, res) => {
    try {
        const { response_id } = req.params;
        const { skor_baru } = req.body; // Dosen mengirimkan nilai angka

        // Cari jawaban mahasiswa di database
        const response = await prisma.student_responses.findUnique({
            where: { id: parseInt(response_id) },
            include: { exams: true }
        });

        if (!response) return res.status(404).json({ message: "Data jawaban tidak ditemukan!" });

        // Validasi keamanan: Hanya dosen pembuat ujian yang boleh menilai
        if (response.exams.kode_dosen !== req.user.id.toString()) {
            return res.status(403).json({ message: "Akses Ditolak! Anda bukan penilai ujian ini." });
        }

        // Update skor dan ubah status menjadi 'selesai'
        const updatedResponse = await prisma.student_responses.update({
            where: { id: parseInt(response_id) },
            data: { 
                skor: parseFloat(skor_baru),
                status_penilaian: 'selesai'
            }
        });

        res.json({ 
            message: "Nilai berhasil diperbarui!", 
            data: updatedResponse 
        });

    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
    }
};