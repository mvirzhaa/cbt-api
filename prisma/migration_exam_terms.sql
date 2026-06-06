-- ==========================================
-- 📜 MIGRATION: Tambah tabel exam_terms
-- Jalankan SQL ini ketika database MySQL sudah aktif
-- ==========================================

CREATE TABLE IF NOT EXISTS `exam_terms` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `exam_id`    INT NOT NULL,
  `isi_syarat` TEXT NOT NULL,
  `urutan`     INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_terms_exam` (`exam_id`),
  CONSTRAINT `exam_terms_exam_fk`
    FOREIGN KEY (`exam_id`)
    REFERENCES `exams` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
