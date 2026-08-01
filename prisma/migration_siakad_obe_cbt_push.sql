-- ==========================================
-- 📜 MIGRATION: Target komponen evaluasi SIAK untuk push nilai CBT (Jalur D)
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Menambahkan:
--   - exams.siakad_rencana_evaluasi_id
--     (id komponen "Rencana Evaluasi" di NL-SIAK/OBE — target push breakdown
--     soal & nilai akhir lewat POST /cbt/komponen/:id/nilai dan
--     POST /cbt/nilai-akhir, diisi manual oleh dosen per ujian bersamaan
--     dengan siakad_kelas_kuliah_id / siakad_periode_akademik_id yang sudah
--     ada, lihat migration_siakad_sync.sql)
-- ==========================================

ALTER TABLE `exams`
  ADD COLUMN `siakad_rencana_evaluasi_id` VARCHAR(64) NULL AFTER `siakad_periode_akademik_id`;
