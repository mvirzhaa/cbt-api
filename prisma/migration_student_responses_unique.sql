-- ==========================================
-- 📜 MIGRATION: Cegah jawaban ganda per mahasiswa/ujian/soal
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Sebelum menjalankan ini, bersihkan dulu baris duplikat yang mungkin
-- sudah terlanjur ada (dari bug submit-ganda sebelum fix ini), contoh:
--
--   DELETE sr1 FROM student_responses sr1
--   INNER JOIN student_responses sr2
--     ON sr1.user_id = sr2.user_id
--     AND sr1.exam_id = sr2.exam_id
--     AND sr1.question_id = sr2.question_id
--     AND sr1.id > sr2.id;
-- ==========================================

ALTER TABLE `student_responses`
  ADD UNIQUE INDEX `uniq_student_response` (`user_id`, `exam_id`, `question_id`);
