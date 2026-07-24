-- ==========================================
-- 📜 MIGRATION: Perkuat AI Proctoring (exam_violations)
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Menambahkan:
--   - jenis_pelanggaran: dari free-text String jadi ENUM tervalidasi,
--     ditambah 5 jenis pelanggaran baru (tab switch, keluar fullscreen,
--     copy-paste, devtools, AI tidak aktif/heartbeat hilang)
--   - foto_bukti: jadi nullable (pelanggaran yang dideteksi server via
--     heartbeat sweep, mis. PENGAWAS_AI_TIDAK_AKTIF, tidak punya screenshot)
--   - status / ditinjau_at / ditinjau_oleh: alur review dosen di dashboard
--     proctoring (mirip pola verified_at/verified_by di exam_attempts)
-- ==========================================

ALTER TABLE `exam_violations`
  MODIFY COLUMN `jenis_pelanggaran` ENUM(
    'TIDAK_ADA_WAJAH',
    'LEBIH_DARI_SATU_WAJAH',
    'BERPINDAH_TAB',
    'KELUAR_LAYAR_PENUH',
    'MENYALIN_TEMPEL',
    'DEVTOOLS_TERDETEKSI',
    'PENGAWAS_AI_TIDAK_AKTIF'
  ) NOT NULL,
  MODIFY COLUMN `foto_bukti` VARCHAR(255) NULL;

ALTER TABLE `exam_violations`
  ADD COLUMN `status` ENUM('BARU', 'DITINJAU') NOT NULL DEFAULT 'BARU' AFTER `waktu_kejadian`,
  ADD COLUMN `ditinjau_at` DATETIME NULL AFTER `status`,
  ADD COLUMN `ditinjau_oleh` INT NULL AFTER `ditinjau_at`;

ALTER TABLE `exam_violations`
  ADD CONSTRAINT `fk_exam_violations_peninjau` FOREIGN KEY (`ditinjau_oleh`) REFERENCES `users`(`id`) ON DELETE SET NULL;
