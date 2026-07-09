-- ==========================================
-- 📜 MIGRATION: Fondasi sinkronisasi nilai CBT -> SIAKAD
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Menambahkan:
--   - exams.siakad_kelas_kuliah_id / siakad_periode_akademik_id
--     (target kelas SIAKAD, diisi manual oleh dosen per ujian)
--   - exam_attempts.siakad_sync_status / siakad_synced_at / siakad_error
--     (status pengiriman nilai per mahasiswa ke SIAKAD)
-- ==========================================

ALTER TABLE `exams`
  ADD COLUMN `siakad_kelas_kuliah_id` VARCHAR(64) NULL AFTER `grading_type`,
  ADD COLUMN `siakad_periode_akademik_id` VARCHAR(64) NULL AFTER `siakad_kelas_kuliah_id`;

ALTER TABLE `exam_attempts`
  ADD COLUMN `siakad_sync_status` ENUM('BELUM_SINKRON', 'ANTRIAN', 'TERKIRIM', 'GAGAL') NOT NULL DEFAULT 'BELUM_SINKRON' AFTER `verified_by`,
  ADD COLUMN `siakad_synced_at` DATETIME(0) NULL AFTER `siakad_sync_status`,
  ADD COLUMN `siakad_error` VARCHAR(255) NULL AFTER `siakad_synced_at`;
