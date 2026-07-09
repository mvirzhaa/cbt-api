-- ==========================================
-- 📜 MIGRATION: Link mata_kuliah lokal ke mata kuliah SIAKAD
-- Jalankan SQL ini ketika database MySQL sudah aktif
--
-- Menambahkan:
--   - mata_kuliah.siakad_id (UUID asli dari SIAKAD, unik, opsional)
--     Dipakai sebagai link ketika admin mengimpor matkul dari SIAKAD lewat
--     GET /api/siakad/matakuliah, supaya satu matkul SIAKAD tidak bisa
--     diimpor dua kali. kode_mk TETAP jadi primary key lokal karena
--     `kode` di SIAKAD tidak dijamin unik (dua matkul berbeda bisa
--     berbagi kode yang sama).
-- ==========================================

ALTER TABLE `mata_kuliah`
  ADD COLUMN `siakad_id` VARCHAR(64) NULL UNIQUE AFTER `dosen_id`;
