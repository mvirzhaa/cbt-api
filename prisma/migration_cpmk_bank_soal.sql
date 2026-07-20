-- ==========================================
-- 📜 MIGRATION: CPMK/Sub-CPMK + Bank Soal (reusable question pool)
-- Jalankan SQL ini ketika database MySQL sudah aktif, lalu jalankan
-- `npx prisma generate` supaya Prisma Client mengikuti schema.prisma terbaru.
--
-- Menambahkan:
--   - cpmk / sub_cpmk: master data patokan soal & nilai per mata kuliah
--     (manual dulu; kolom external_id disiapkan untuk sinkronisasi
--     OBE/SIAKAD di masa depan, belum ada integrasi live)
--   - question_bank / question_bank_options: pool soal reusable per
--     mata kuliah, diimpor (COPY, bukan reference) ke exam via
--     questionBankController.importFromBank
--   - questions.cpmk_id / questions.sub_cpmk_id: kolom baru nullable,
--     berjalan berdampingan dengan questions.cpmk (teks bebas lama)
-- ==========================================

CREATE TABLE IF NOT EXISTS `cpmk` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `kode_mk`     VARCHAR(50) NOT NULL,
  `kode_cpmk`   VARCHAR(50) NOT NULL,
  `deskripsi`   TEXT NOT NULL,
  `external_id` VARCHAR(64) NULL,
  `created_at`  TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `cpmk_external_id_key` (`external_id`),
  UNIQUE INDEX `cpmk_kode_mk_kode_cpmk_key` (`kode_mk`, `kode_cpmk`),
  INDEX `kode_mk` (`kode_mk`),
  CONSTRAINT `cpmk_kode_mk_fkey`
    FOREIGN KEY (`kode_mk`)
    REFERENCES `mata_kuliah` (`kode_mk`)
    ON DELETE CASCADE
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sub_cpmk` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `cpmk_id`        INT NOT NULL,
  `kode_sub_cpmk`  VARCHAR(50) NOT NULL,
  `deskripsi`      TEXT NOT NULL,
  `external_id`    VARCHAR(64) NULL,
  `created_at`     TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sub_cpmk_external_id_key` (`external_id`),
  UNIQUE INDEX `sub_cpmk_cpmk_id_kode_sub_cpmk_key` (`cpmk_id`, `kode_sub_cpmk`),
  INDEX `cpmk_id` (`cpmk_id`),
  CONSTRAINT `sub_cpmk_cpmk_id_fkey`
    FOREIGN KEY (`cpmk_id`)
    REFERENCES `cpmk` (`id`)
    ON DELETE CASCADE
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `question_bank` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `kode_mk`       VARCHAR(50) NOT NULL,
  `dibuat_oleh`   VARCHAR(50) NOT NULL,
  `cpmk_id`       INT NULL,
  `sub_cpmk_id`   INT NULL,
  `tipe_soal`     ENUM('1','2','3','4') NOT NULL,
  `isi_soal`      TEXT NOT NULL,
  `kunci_jawaban` TEXT NULL,
  `bobot_nilai`   DECIMAL(5,2) NULL DEFAULT 10.00,
  `sumber`        ENUM('MANUAL','AI_GENERATED') NOT NULL DEFAULT 'MANUAL',
  `created_at`    TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `kode_mk` (`kode_mk`),
  INDEX `sub_cpmk_id` (`sub_cpmk_id`),
  CONSTRAINT `question_bank_kode_mk_fkey`
    FOREIGN KEY (`kode_mk`)
    REFERENCES `mata_kuliah` (`kode_mk`)
    ON DELETE CASCADE
    ON UPDATE RESTRICT,
  CONSTRAINT `question_bank_cpmk_id_fkey`
    FOREIGN KEY (`cpmk_id`)
    REFERENCES `cpmk` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `question_bank_sub_cpmk_id_fkey`
    FOREIGN KEY (`sub_cpmk_id`)
    REFERENCES `sub_cpmk` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `question_bank_options` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `question_bank_id` INT NOT NULL,
  `label_pilihan`    VARCHAR(5) NOT NULL,
  `teks_pilihan`     TEXT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `question_bank_id` (`question_bank_id`),
  CONSTRAINT `question_bank_options_question_bank_id_fkey`
    FOREIGN KEY (`question_bank_id`)
    REFERENCES `question_bank` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `questions`
  ADD COLUMN `cpmk_id` INT NULL AFTER `cpmk`,
  ADD COLUMN `sub_cpmk_id` INT NULL AFTER `cpmk_id`,
  ADD INDEX `questions_sub_cpmk_id_idx` (`sub_cpmk_id`),
  ADD CONSTRAINT `questions_cpmk_id_fkey`
    FOREIGN KEY (`cpmk_id`)
    REFERENCES `cpmk` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT `questions_sub_cpmk_id_fkey`
    FOREIGN KEY (`sub_cpmk_id`)
    REFERENCES `sub_cpmk` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
