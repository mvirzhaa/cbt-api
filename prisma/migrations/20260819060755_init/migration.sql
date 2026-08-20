-- CreateTable
CREATE TABLE `exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_mk` VARCHAR(50) NOT NULL,
    `kode_dosen` VARCHAR(50) NOT NULL,
    `nama_ujian` VARCHAR(255) NOT NULL,
    `token_ujian` VARCHAR(20) NOT NULL,
    `waktu_mulai` DATETIME(0) NOT NULL,
    `waktu_selesai` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `durasi` INTEGER NULL DEFAULT 90,
    `bobot_pilgan` INTEGER NOT NULL DEFAULT 100,
    `bobot_esai` INTEGER NOT NULL DEFAULT 0,
    `bobot_upload` INTEGER NOT NULL DEFAULT 0,
    `grading_type` ENUM('PER_SOAL', 'PER_KATEGORI') NULL DEFAULT 'PER_KATEGORI',
    `siakad_kelas_kuliah_id` VARCHAR(64) NULL,
    `siakad_periode_akademik_id` VARCHAR(64) NULL,
    `siakad_rencana_evaluasi_id` VARCHAR(64) NULL,

    UNIQUE INDEX `token_ujian`(`token_ujian`),
    INDEX `kode_mk`(`kode_mk`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mata_kuliah` (
    `kode_mk` VARCHAR(50) NOT NULL,
    `nama_mk` VARCHAR(255) NOT NULL,
    `dosen_id` INTEGER NULL,
    `siakad_id` VARCHAR(64) NULL,

    UNIQUE INDEX `mata_kuliah_siakad_id_key`(`siakad_id`),
    PRIMARY KEY (`kode_mk`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cpmk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_mk` VARCHAR(50) NOT NULL,
    `kode_cpmk` VARCHAR(50) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `external_id` VARCHAR(64) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `cpmk_external_id_key`(`external_id`),
    INDEX `cpmk_kode_mk_idx`(`kode_mk`),
    UNIQUE INDEX `cpmk_kode_mk_kode_cpmk_key`(`kode_mk`, `kode_cpmk`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_cpmk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cpmk_id` INTEGER NOT NULL,
    `kode_sub_cpmk` VARCHAR(50) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `external_id` VARCHAR(64) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sub_cpmk_external_id_key`(`external_id`),
    INDEX `sub_cpmk_cpmk_id_idx`(`cpmk_id`),
    UNIQUE INDEX `sub_cpmk_cpmk_id_kode_sub_cpmk_key`(`cpmk_id`, `kode_sub_cpmk`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_bank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_mk` VARCHAR(50) NOT NULL,
    `dibuat_oleh` VARCHAR(50) NOT NULL,
    `cpmk_id` INTEGER NULL,
    `sub_cpmk_id` INTEGER NULL,
    `tipe_soal` ENUM('1', '2', '3', '4') NOT NULL,
    `isi_soal` TEXT NOT NULL,
    `kunci_jawaban` TEXT NULL,
    `bobot_nilai` DECIMAL(5, 2) NULL DEFAULT 10.00,
    `sumber` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `question_bank_kode_mk_idx`(`kode_mk`),
    INDEX `question_bank_sub_cpmk_id_idx`(`sub_cpmk_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_bank_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_bank_id` INTEGER NOT NULL,
    `label_pilihan` VARCHAR(5) NOT NULL,
    `teks_pilihan` TEXT NOT NULL,

    INDEX `question_bank_options_question_bank_id_idx`(`question_bank_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `label_pilihan` VARCHAR(5) NOT NULL,
    `teks_pilihan` TEXT NOT NULL,

    INDEX `question_id`(`question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `cpmk` VARCHAR(100) NOT NULL,
    `cpmk_id` INTEGER NULL,
    `sub_cpmk_id` INTEGER NULL,
    `tipe_soal` ENUM('1', '2', '3', '4') NOT NULL,
    `isi_soal` TEXT NOT NULL,
    `kunci_jawaban` TEXT NULL,
    `bobot_nilai` DECIMAL(5, 2) NULL DEFAULT 0.00,

    INDEX `exam_id`(`exam_id`),
    INDEX `questions_sub_cpmk_id_idx`(`sub_cpmk_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `exam_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `jawaban_teks` TEXT NULL,
    `file_path` VARCHAR(255) NULL,
    `skor` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `status_penilaian` ENUM('menunggu', 'selesai') NULL DEFAULT 'menunggu',

    INDEX `exam_id`(`exam_id`),
    INDEX `question_id`(`question_id`),
    INDEX `user_id`(`user_id`),
    UNIQUE INDEX `uniq_student_response`(`user_id`, `exam_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nim` VARCHAR(50) NULL,
    `nama` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('super_admin', 'admin', 'dosen', 'mahasiswa') NULL DEFAULT 'mahasiswa',
    `status_aktif` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `nim`(`nim`),
    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materi_kuliah` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_mk` VARCHAR(50) NOT NULL,
    `dosen_id` INTEGER NOT NULL,
    `judul` VARCHAR(255) NOT NULL,
    `deskripsi` TEXT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_materi_mk`(`kode_mk`),
    INDEX `idx_materi_dosen`(`dosen_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_violations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `exam_id` INTEGER NOT NULL,
    `jenis_pelanggaran` ENUM('TIDAK_ADA_WAJAH', 'LEBIH_DARI_SATU_WAJAH', 'BERPINDAH_TAB', 'KELUAR_LAYAR_PENUH', 'MENYALIN_TEMPEL', 'DEVTOOLS_TERDETEKSI', 'PENGAWAS_AI_TIDAK_AKTIF', 'TIDAK_MENGGUNAKAN_SEB', 'KETIKAN_TIDAK_WAJAR', 'MOUSE_TIDAK_AKTIF') NOT NULL,
    `foto_bukti` VARCHAR(191) NULL,
    `waktu_kejadian` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('BARU', 'DITINJAU') NOT NULL DEFAULT 'BARU',
    `ditinjau_at` DATETIME(3) NULL,
    `ditinjau_oleh` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `exam_id` INTEGER NOT NULL,
    `skor_pilgan_100` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `skor_esai_100` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `skor_file_100` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `final_score` DECIMAL(5, 2) NULL,
    `status` ENUM('MENUNGGU_VERIFIKASI', 'SELESAI') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    `submitted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `verified_at` TIMESTAMP(0) NULL,
    `verified_by` INTEGER NULL,
    `siakad_sync_status` ENUM('BELUM_SINKRON', 'ANTRIAN', 'TERKIRIM', 'GAGAL') NOT NULL DEFAULT 'BELUM_SINKRON',
    `siakad_synced_at` DATETIME(0) NULL,
    `siakad_error` VARCHAR(255) NULL,

    INDEX `exam_attempts_exam_id_idx`(`exam_id`),
    INDEX `exam_attempts_user_id_idx`(`user_id`),
    UNIQUE INDEX `exam_attempts_user_id_exam_id_key`(`user_id`, `exam_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_terms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `isi_syarat` TEXT NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_terms_exam`(`exam_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`kode_mk`) REFERENCES `mata_kuliah`(`kode_mk`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `mata_kuliah` ADD CONSTRAINT `mata_kuliah_dosen_id_fkey` FOREIGN KEY (`dosen_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cpmk` ADD CONSTRAINT `cpmk_kode_mk_fkey` FOREIGN KEY (`kode_mk`) REFERENCES `mata_kuliah`(`kode_mk`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `sub_cpmk` ADD CONSTRAINT `sub_cpmk_cpmk_id_fkey` FOREIGN KEY (`cpmk_id`) REFERENCES `cpmk`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `question_bank` ADD CONSTRAINT `question_bank_kode_mk_fkey` FOREIGN KEY (`kode_mk`) REFERENCES `mata_kuliah`(`kode_mk`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `question_bank` ADD CONSTRAINT `question_bank_cpmk_id_fkey` FOREIGN KEY (`cpmk_id`) REFERENCES `cpmk`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_bank` ADD CONSTRAINT `question_bank_sub_cpmk_id_fkey` FOREIGN KEY (`sub_cpmk_id`) REFERENCES `sub_cpmk`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_bank_options` ADD CONSTRAINT `question_bank_options_question_bank_id_fkey` FOREIGN KEY (`question_bank_id`) REFERENCES `question_bank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_cpmk_id_fkey` FOREIGN KEY (`cpmk_id`) REFERENCES `cpmk`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_sub_cpmk_id_fkey` FOREIGN KEY (`sub_cpmk_id`) REFERENCES `sub_cpmk`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_responses` ADD CONSTRAINT `student_responses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_responses` ADD CONSTRAINT `student_responses_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_responses` ADD CONSTRAINT `student_responses_ibfk_3` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `materi_kuliah` ADD CONSTRAINT `fk_materi_mk` FOREIGN KEY (`kode_mk`) REFERENCES `mata_kuliah`(`kode_mk`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `materi_kuliah` ADD CONSTRAINT `fk_materi_dosen` FOREIGN KEY (`dosen_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_violations` ADD CONSTRAINT `exam_violations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_violations` ADD CONSTRAINT `exam_violations_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_violations` ADD CONSTRAINT `exam_violations_ditinjau_oleh_fkey` FOREIGN KEY (`ditinjau_oleh`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_terms` ADD CONSTRAINT `exam_terms_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
