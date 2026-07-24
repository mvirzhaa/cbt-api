-- ==========================================
-- 📜 MIGRATION: Sinyal Proctoring Tambahan (deteksi SEB, ketikan, mouse)
-- Jalankan SQL ini ketika database MySQL sudah aktif (setelah
-- migration_proctoring_violation_enhancements.sql sudah diterapkan)
--
-- Menambahkan 3 jenis pelanggaran baru ke exam_violations.jenis_pelanggaran:
--   - TIDAK_MENGGUNAKAN_SEB: User-Agent browser saat ujian tidak menunjukkan
--     signature Safe Exam Browser (mode detect-only, tidak memblokir ujian).
--   - KETIKAN_TIDAK_WAJAR: Terdeteksi input teks esai yang masuk lewat paste/drop
--     (InputEvent.inputType) alih-alih ketikan manual — sinyal metadata saja,
--     TIDAK merekam isi ketikan mahasiswa.
--   - MOUSE_TIDAK_AKTIF: Mouse & keyboard sama-sama tidak ada aktivitas dalam
--     jangka waktu lama saat ujian berlangsung (indikasi kemungkinan remote
--     control/automation atau perangkat ditinggal).
-- ==========================================

ALTER TABLE `exam_violations`
  MODIFY COLUMN `jenis_pelanggaran` ENUM(
    'TIDAK_ADA_WAJAH',
    'LEBIH_DARI_SATU_WAJAH',
    'BERPINDAH_TAB',
    'KELUAR_LAYAR_PENUH',
    'MENYALIN_TEMPEL',
    'DEVTOOLS_TERDETEKSI',
    'PENGAWAS_AI_TIDAK_AKTIF',
    'TIDAK_MENGGUNAKAN_SEB',
    'KETIKAN_TIDAK_WAJAR',
    'MOUSE_TIDAK_AKTIF'
  ) NOT NULL;
