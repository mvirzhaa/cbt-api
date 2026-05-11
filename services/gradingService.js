/**
 * Mesin Kalkulasi Skor Ujian Dinamis
 * Mendukung perhitungan mutlak (Per-Soal) dan persentase (Per-Kategori)
 */
exports.calculateFinalScore = (responses, questions, examConfig) => {
    let totalScore = 0;
    let isAllGraded = true;
    
    // Keranjang rekapan per kategori
    let summary = {
        TIPE_1: { obtained: 0, max: 0 }, // Pilgan
        TIPE_3: { obtained: 0, max: 0 }, // Esai (AI)
        TIPE_4: { obtained: 0, max: 0 }  // Upload
    };

    // 1. Kumpulkan nilai mentah dari seluruh jawaban
    responses.forEach(resp => {
        const soal = questions.find(q => q.id === resp.question_id);
        if (!soal) return;

        // Ambil bobot maksimal soal dari database (default 10 jika kosong)
        const bobotMaksimal = soal.bobot_nilai ? parseFloat(soal.bobot_nilai) : 10.0;
        const skorDiperoleh = resp.skor ? parseFloat(resp.skor) : 0;

        // Cek apakah ada yang masih gantung (belum dinilai dosen/AI)
        if (resp.status_penilaian === 'menunggu') {
            isAllGraded = false;
        }

        // Masukkan ke keranjang masing-masing
        if (summary[soal.tipe_soal]) {
            summary[soal.tipe_soal].obtained += skorDiperoleh;
            summary[soal.tipe_soal].max += bobotMaksimal;
        }
    });

    // 2. Kalkulasi berdasarkan Tipe Penilaian Dosen
    if (examConfig.grading_type === 'PER_KATEGORI') {
        // PER KATEGORI: Hitung rasio (Diperoleh / Maksimal) * Bobot Persentase Dosen
        
        // Pilihan Ganda
        const rasioPilgan = summary.TIPE_1.max > 0 ? (summary.TIPE_1.obtained / summary.TIPE_1.max) : 0;
        const skorFinalPilgan = rasioPilgan * (examConfig.bobot_pilgan || 0);

        // Esai
        const rasioEsai = summary.TIPE_3.max > 0 ? (summary.TIPE_3.obtained / summary.TIPE_3.max) : 0;
        const skorFinalEsai = rasioEsai * (examConfig.bobot_esai || 0);

        // Upload
        const rasioUpload = summary.TIPE_4.max > 0 ? (summary.TIPE_4.obtained / summary.TIPE_4.max) : 0;
        const skorFinalUpload = rasioUpload * (examConfig.bobot_upload || 0);

        totalScore = skorFinalPilgan + skorFinalEsai + skorFinalUpload;

    } else {
        // PER SOAL: Abaikan persentase, langsung jumlahkan semua skor mentah
        totalScore = summary.TIPE_1.obtained + summary.TIPE_3.obtained + summary.TIPE_4.obtained;
    }

    // Bulatkan hasil akhir ke 2 angka di belakang koma untuk presisi
    totalScore = Math.round(totalScore * 100) / 100;

    return { 
        totalScore, 
        isAllGraded, 
        breakdown: summary 
    };
};