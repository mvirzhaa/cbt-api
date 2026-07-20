-- ==========================================
-- 📜 MIGRATION: Backfill grading_type sebelum PER_SOAL diaktifkan beneran
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- KENAPA INI PENTING:
-- Kolom exams.grading_type defaultnya PER_SOAL, tapi selama ini TIDAK
-- PERNAH bisa diset lewat API manapun (createExam/updateExam tidak
-- mengekspornya) dan dosenController.verifyExam SELALU memakai rumus
-- PER_KATEGORI apapun isi kolom ini. Jadi semua ujian yang sudah ada
-- sekarang berperilaku PER_KATEGORI, walau kolomnya mungkin tertulis
-- PER_SOAL (default kosong).
--
-- Begitu verifyExam mulai benar-benar bercabang berdasarkan grading_type
-- (lihat controllers/dosenController.js), ujian lama yang kolomnya
-- kebetulan PER_SOAL akan tiba-tiba dihitung pakai rumus baru tanpa
-- dosen memilih itu. Migration ini mengunci semua ujian yang SUDAH ADA
-- ke PER_KATEGORI secara eksplisit supaya perilakunya tidak berubah.
-- Ujian BARU yang dibuat setelah ini bebas pilih PER_SOAL lewat form.
-- ==========================================

UPDATE `exams` SET `grading_type` = 'PER_KATEGORI';

ALTER TABLE `exams`
  MODIFY COLUMN `grading_type` ENUM('PER_SOAL','PER_KATEGORI') NULL DEFAULT 'PER_KATEGORI';
