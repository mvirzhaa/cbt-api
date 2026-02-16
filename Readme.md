# 🚀 RESTful API - Sistem CBT (Computer Based Test) Terintegrasi

Sistem _Backend_ berbasis Node.js untuk mengelola ujian _online_ (CBT) berskala menengah-besar. Dirancang dengan arsitektur _Multi-Tenant_, _Role-Based Access Control_ (RBAC) yang ketat, dan fitur _Auto-Grading_ cerdas.

## ✨ Fitur Utama (Key Features)

- **🔐 Sistem Keamanan Ganda (RBAC):** Akses terisolasi antara `Super Admin`, `Admin`, `Dosen`, dan `Mahasiswa` menggunakan **JWT (JSON Web Token)**. Akun pendaftar tidak langsung aktif hingga divalidasi oleh Admin.
- **🏢 Multi-Tenant Architecture:** Mendukung banyak mata kuliah dan banyak dosen dalam satu ekosistem sistem terpusat.
- **📝 Manajemen 4 Tipe Soal Kompleks:** \* Tipe 1: Pilihan Ganda (Otomatis dinilai)
  - Tipe 2: Teks Pendek (Otomatis dinilai via _exact match_)
  - Tipe 3: Esai Panjang (Otomatis dinilai via _Keyword Matching_ percentage)
  - Tipe 4: Upload File Jawaban Manual (Disimpan di server lokal via Multer)
- **🎫 Auto-Generate Token Ujian:** Sistem keamanan gerbang ujian otomatis di mana Mahasiswa wajib memasukkan 6 digit token acak yang di-_generate_ saat Dosen membuat jadwal ujian.
- **🎯 Indikator CPMK:** Setiap soal dapat dikaitkan dengan Capaian Pembelajaran Mata Kuliah (CPMK) untuk pelacakan kualitas pendidikan.

## 🛠️ Teknologi yang Digunakan (Tech Stack)

- **Runtime Environment:** Node.js
- **Web Framework:** Express.js
- **Database:** MySQL
- **ORM:** Prisma
- **Keamanan:** Bcrypt.js (Password Hashing) & JSON Web Token (JWT)
- **File Management:** Multer

---

## 💻 Panduan Instalasi (Local Setup)

Ikuti langkah-langkah berikut untuk menjalankan sistem API ini di komputer lokal:

### 1. Prasyarat Sistem

- Node.js (v16 atau lebih baru) terinstal.
- XAMPP / Laragon (Apache & MySQL) berjalan.
- Postman / Thunder Client untuk _testing_ API.

### 2. Kloning dan Instalasi Dependensi

Buka terminal dan jalankan:

```bash
npm install
```
