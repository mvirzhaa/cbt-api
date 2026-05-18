# INSTRUKSI REVISI SISTEM CBT UCL (AUTO-GRADING & BOBOT NILAI)

## Konteks Perubahan

1. **Alur Auto-Grading (Human-in-the-Loop)**: AI tidak boleh lagi langsung merilis nilai ke mahasiswa. Setelah submit, semua ujian harus berstatus `MENUNGGU_VERIFIKASI`. Dosen harus memverifikasi/mengubah nilai AI di backend/web sebelum status berubah menjadi `SELESAI`.
2. **Kalkulasi Bobot Nilai**: Nilai akhir harus dikalkulasi berdasarkan bobot persentase per kategori. Nilai mentah dikonversi ke 0-100, lalu dikali bobot (contoh: 30% pilgan, 40% esai, 30% file).

## Task 1: Update Database & Backend Submission

**File Target:** `backend/controllers/examController.js` (atau file service submit ujian yang relevan)

- Saat mahasiswa `POST /submit`, sistem tetap menjalankan fungsi AI _text-similarity_ untuk menilai soal esai dan mencocokkan kunci jawaban pilihan ganda.
- **Ubah Perilaku:** Jangan langsung menjumlahkan `total_skor` akhir. Simpan perolehan nilai mentah per kategori (skor AI dan Pilgan) ke dalam tabel `exam_attempts` (atau sejenisnya) dalam bentuk skala 0-100.
- **Ubah Status:** Paksa (hardcode) status pengerjaan menjadi `MENUNGGU_VERIFIKASI` (atau status serupa yang menahan nilai agar tidak rilis), terlepas dari apakah ada soal unggah file atau tidak.

## Task 2: Buat Endpoint Verifikasi Dosen (Perhitungan Bobot)

**File Target:** `backend/routes/dosenRoutes.js` & `backend/controllers/dosenController.js`

- Buat endpoint `POST /api/dosen/verify-exam/:attempt_id` untuk menerima validasi nilai dari dosen.
- Endpoint ini menerima payload nilai final dari dosen: `{ skor_pilgan_100, skor_esai_100, skor_file_100 }`.
- **Logika Kalkulasi Bobot:**
  Ambil data bobot dari tabel `exams` (`bobot_pilgan`, `bobot_esai`, `bobot_upload`).
  Pastikan nilainya desimal (contoh: 30 = 0.3).
  ```javascript
  const final_score =
    skor_pilgan_100 * (bobot_pilgan / 100) +
    skor_esai_100 * (bobot_esai / 100) +
    skor_file_100 * (bobot_upload / 100);
  ```
