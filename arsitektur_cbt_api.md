# Dokumentasi Arsitektur & Struktur Folder CBT-API

Dokumen ini menjelaskan arsitektur, struktur folder, alur (flow), dan detail komponen dari source code `cbt-api` (Computer Based Test API).

## 1. Arsitektur Umum

`cbt-api` adalah aplikasi backend berbasis **Node.js** dan **Express.js** yang berfungsi sebagai RESTful API untuk sistem ujian berbasis komputer. Sistem ini dirancang untuk menangani multi-peran (Super Admin, Admin, Dosen, Mahasiswa) dan memiliki fitur unggulan **AI Auto-Grader** serta tenant isolation (isolasi akses data antar dosen).

Aplikasi ini menggunakan pola arsitektur yang terpusat dengan sebagian rute modular, di mana:

*   **Model/Database**: Menggunakan **Prisma ORM** yang berinteraksi dengan database **MySQL**. Skema database didefinisikan dalam file `schema.prisma`.
*   **Controller & Route**: Sebagian besar logika dan definisi endpoint (terutama untuk manajemen ujian, master data, dan fitur inti CBT) ditulis secara langsung di dalam file utama (`index.js`). Namun, beberapa fitur tambahan dipisah ke dalam folder `controllers/` dan `routes/` (seperti *materi* dan *proctoring*).
*   **Authentication & Authorization**: Menggunakan **JSON Web Token (JWT)** untuk autentikasi dan *Role-Based Access Control* (RBAC) melalui middleware untuk membedakan hak akses (misalnya `isAdmin`, `isDosen`).

### Stack Teknologi Utama:
*   **Backend Framework**: Express.js
*   **Database**: MySQL
*   **ORM**: Prisma
*   **Authentication**: JSON Web Token (JWT), bcryptjs
*   **AI/Penilaian**: `string-similarity` (untuk koreksi otomatis soal esai)
*   **Penyimpanan Media**: Multer (untuk upload file/jawaban ujian)

---

## 2. Struktur Folder & Detail Komponen

Berikut adalah penjelasan mendetail dari setiap folder dan file kunci yang ada di root direktori proyek.

### File Root Penting

*   **`index.js`**: Titik masuk (entry point) utama dari aplikasi Express.
    *   **Fungsi**: File ini menginisialisasi server Express, mengatur CORS, menghubungkan Prisma Client, mendaftarkan *routes* modular, dan **mendefinisikan sebagian besar *routes* dan *logic* utama** (seperti Admin user management, Master Mata Kuliah, CRUD Ujian & Soal, Verifikasi Token Ujian Mahasiswa, serta Submit Ujian yang memuat logika *AI Auto-Grader*).
    *   **Efek**: Ini adalah *core* dari aplikasi. Modifikasi logika penilaian ujian, toleransi waktu mulai ujian, bobot nilai, dan sinkronisasi skor semuanya berjalan di sini. Kesalahan pada file ini akan menyebabkan API inti tidak bisa diakses.
*   **`package.json` & `package-lock.json`**:
    *   **Fungsi**: Berisi metadata proyek dan daftar library (seperti `express`, `@prisma/client`, `cors`, `multer`, `string-similarity`, dll).
*   **`.env`**:
    *   **Fungsi**: Menyimpan Environment Variables sensitif seperti `DATABASE_URL` (koneksi MySQL) dan `JWT_SECRET`.
*   **`Readme.md`**:
    *   **Fungsi**: Dokumentasi singkat proyek yang menjelaskan fitur, setup lokal, tipe soal (TIPE_1 hingga TIPE_4), dan daftar endpoint.

### Direktori Utama

#### 1. `prisma/`
*   **Isi**: File skema dan konfigurasi ORM Prisma.
*   **Detail**: Terdapat file `schema.prisma` yang mendefinisikan seluruh struktur tabel database MySQL (seperti tabel Users, Exams, Questions, Question_options, Student_responses, dll) dan relasinya.
*   **Efek**: File ini adalah *Single Source of Truth* untuk struktur database. Jika ada perubahan struktur (menambah kolom baru), harus dilakukan di file ini lalu menjalankan perintah migrasi (`npx prisma migrate`).

#### 2. `middlewares/`
*   **Isi**: Fungsi-fungsi perantara yang dieksekusi sebelum request mencapai logika utama.
*   **Detail**:
    *   `authMiddleware.js`: Berisi fungsi `verifyToken` untuk memvalidasi JWT dari *header* request. Juga berisi *guard* seperti `isAdmin`, `isDosen`, `isDosenOrSuperAdmin` untuk memblokir akses dari pengguna yang tidak berhak.
    *   `uploadMiddleware.js`: Menggunakan **Multer** untuk mengelola *file upload*. Mengatur di mana file disimpan (`uploads/`) dan batas/aturan upload.
*   **Efek**: Melindungi aplikasi dari akses tanpa izin (security). Jika middleware ini salah konfigurasi, mahasiswa mungkin bisa mengakses endpoint dosen, atau sebaliknya.

#### 3. `routes/`
*   **Isi**: File pendefinisian rute URL untuk modul-modul spesifik di luar `index.js`.
*   **Detail**: Terdapat `materi.js` (untuk fitur LMS/modul materi belajar) dan `proctoring.js` (untuk fitur pengawasan ujian).
*   **Efek**: Mengisolasi fitur tambahan agar `index.js` tidak terlalu membengkak. Error di sini hanya akan mematikan fitur materi atau proctoring tanpa mengganggu sistem ujian utama.

#### 4. `controllers/`
*   **Isi**: Mengandung logika bisnis yang terpisah.
*   **Detail**: Terdapat beberapa file seperti `authController.js` (mengurus register & login), `examController.js`, `gradingController.js`, `masterController.js`, `questionController.js`, dan `studentController.js`.
*   **Catatan Arsitektur**: Meskipun file-file controller ini ada, struktur `index.js` terlihat memuat banyak sekali *logic* secara langsung (monolitik di *entry point*). Beberapa fungsi mungkin ditarik dari *controllers* ini, namun banyak endpoint krusial didefinisikan langsung dengan fungsi *inline* di `index.js`.
*   **Efek**: Membantu merapikan kode untuk fitur-fitur tertentu. Error di controller akan menyebabkan endpoint terkait me-return status 500.

#### 5. `uploads/`
*   **Isi**: Folder tempat menyimpan file-file fisik hasil unggahan.
*   **Detail**: Digunakan untuk menyimpan jawaban ujian berupa file (dari soal `TIPE_4`) atau media pendukung materi/proctoring. Di-ekspos secara statis oleh Express (`app.use('/uploads', express.static(...))`).
*   **Efek**: Jika direktori ini terhapus atau tidak memiliki *permission* write, fitur unggah jawaban ujian atau file materi akan gagal beroperasi.

#### 6. `generated/`
*   **Isi/Detail**: Folder ini umumnya dihasilkan secara otomatis, biasanya berisi *build output* atau utilitas spesifik hasil dari suatu *generator script* (seperti Prisma Client jika dikonfigurasi untuk di-generate ke folder khusus, walau umumnya di `node_modules`).

---

## 3. Alur Request Utama (Flow)

Sistem CBT ini memfasilitasi banyak alur, namun alur paling krusial adalah **Pelaksanaan Ujian oleh Mahasiswa & Penilaian**. Berikut adalah *flow*-nya:

### A. Persiapan (Oleh Dosen)
1. Dosen membuat ujian (`POST /api/exams`).
2. Dosen menambahkan soal-soal ke dalam ujian (`POST /api/questions`).
   * Terdapat 4 tipe soal: `TIPE_1` (Pilihan Ganda), `TIPE_2` (Teks Pendek), `TIPE_3` (Esai), `TIPE_4` (Upload File).

### B. Pelaksanaan (Oleh Mahasiswa)
1. **Verifikasi Token**: Mahasiswa memasukkan token ujian. Client memanggil `POST /api/student/verify-token`.
   * Sistem di `index.js` akan mengecek apakah ujian ada, mengecek waktu mulai (dengan **toleransi 5 menit awal**), dan memastikan ujian belum ditutup.
2. **Mengerjakan Ujian**: Frontend merender soal.
3. **Submit Ujian & AI Auto-Grader**: Mahasiswa mengirim seluruh jawaban via `POST /api/student/submit-exam`.
   * Request melewati middleware Multer untuk menangkap file lampiran jika ada.
   * `index.js` memproses secara *loop* untuk setiap soal:
     * **TIPE_1 (Pilgan)**: Mencocokkan teks, index, atau huruf (`A`, `B`, `C`, `D`) dengan `kunci_jawaban`. Jika benar skor didapat secara otomatis, status menjadi `selesai`.
     * **TIPE_3 (Esai)**: Menggunakan library `string-similarity` (AI Auto-Grader sederhana) untuk membandingkan teks jawaban mahasiswa dengan `kunci_jawaban` dosen. Menghasilkan skor akurasi (0.00 hingga 1.00) dikalikan dengan bobot soal. Status menjadi `selesai`.
     * **TIPE_2 & TIPE_4**: Diberi skor 0 sementara, status `menunggu` untuk dikoreksi manual.
   * Data jawaban disimpan ke `student_responses`. Sistem mengembalikan total skor otomatis.

### C. Penilaian Manual & Rekap (Oleh Dosen)
1. Dosen memanggil `GET /api/grading/exams/:exam_id/answers` untuk melihat jawaban yang masih berstatus `menunggu`.
2. Dosen memberikan nilai melalui `PUT /api/grading/responses/:response_id/score`.
3. Dosen menarik hasil akhir ujian melalui `GET /api/exams/:exam_id/rekap-detail`.
   * Endpoint di `index.js` ini sangat vital karena melakukan kalkulasi komprehensif: memecah skor mentah mahasiswa menjadi skor kategori (Pilgan, Esai, Upload), membagi dengan skor maksimal masing-masing kategori, lalu mengalikannya dengan bobot kategori yang ditetapkan dosen (misal: 30% Pilgan, 70% Esai) untuk menghasilkan `total_skor` yang adil.

## Kesimpulan

Arsitektur `cbt-api` memiliki struktur dasar MVC namun cenderung **monolitik terpusat pada `index.js`** untuk *logic* inti ujian. Pendekatan ini memudahkan penelusuran kode alur ujian secara utuh pada satu file (karena semua perhitungan *auto-grading* dan rekap nilai ada di tempat yang sama). 

Penggunaan Prisma ORM memastikan interaksi database yang aman (Type-Safe), sedangkan implementasi AI Auto-Grader (berbasis komparasi string) memberikan efisiensi tinggi bagi dosen dalam mengoreksi soal esai. Keamanan terjaga dengan baik berkat pengecekan kepemilikan data (*Tenant Isolation*) di mana dosen hanya bisa memodifikasi atau menilai ujian yang mereka buat sendiri.
