-- ==========================================
-- 📜 MIGRATION: Lockdown ujian via Safe Exam Browser (SEB) resmi
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Menambahkan:
--   - exams.seb_require  (ujian ini WAJIB diakses lewat SEB asli atau tidak)
--   - exams.seb_config   (config object hasil normalisasi generateSEBConfig(),
--     disimpan utuh supaya Config Key bisa dihitung ulang konsisten dengan
--     file .seb yang sudah diunduh -- lihat services/sebService.js)
-- ==========================================

ALTER TABLE `exams`
  ADD COLUMN `seb_require` BOOLEAN NOT NULL DEFAULT false AFTER `siakad_bobot_cpmk`,
  ADD COLUMN `seb_config` JSON NULL AFTER `seb_require`;
