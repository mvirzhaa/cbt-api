# RESTful API CBT

Backend API berbasis Node.js untuk sistem Computer Based Test (CBT) multi-peran.

## Fitur Utama

- Otentikasi JWT dengan aktivasi akun oleh admin.
- RBAC untuk `super_admin`, `admin`, `dosen`, `mahasiswa`.
- Manajemen mata kuliah, ujian, bank soal, dan penilaian.
- 4 tipe soal:
  - `TIPE_1`: Pilihan ganda single choice (5 opsi A-E, pilih 1, auto-grade).
  - `TIPE_2`: Pilihan ganda multiple choice (5 opsi A-E, pilih > 1, auto-grade dengan partial scoring).
  - `TIPE_3`: Esai (auto-grade menggunakan Gemini AI dengan background queue).
  - `TIPE_4`: Upload file (penilaian manual).
- Upload jawaban file via Multer.
- Rekap nilai per mata kuliah dan per sesi ujian.

## Tech Stack

- Node.js + Express
- MySQL + Prisma ORM
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Upload file (`multer`)
- AI Integration (`@google/generative-ai` - Gemini 2.5-flash)

## Keamanan

- Endpoint admin dilindungi `verifyToken + isAdmin`.
- Endpoint dosen dilindungi `verifyToken + isDosen` / `isDosenOrSuperAdmin`.
- Ownership check diterapkan pada resource sensitif (ujian, soal, grading).
- Jalur darurat pembuatan admin sudah dihapus.
- `JWT_SECRET` wajib ada di environment (tidak ada fallback hardcoded).

## Prasyarat

- Node.js 16+ (disarankan 18+)
- MySQL aktif

## Setup Lokal

```bash
npm install
```

Buat file `.env` minimal:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
JWT_SECRET="ganti_dengan_secret_kuat"
GEMINI_API_KEY="your_gemini_api_key_here"
PORT=3000
```

Migrasi Prisma (sesuaikan dengan workflow kamu):

```bash
npx prisma generate
npx prisma migrate dev
```

Jalankan server:

```bash
node index.js
```

## Catatan Endpoint

- `POST /api/register`
- `POST /api/login`
- Admin:
  - `PUT /api/admin/users/:id/approve`
  - `GET /api/admin/users/pending`
  - `GET /api/admin/users/active`
  - `DELETE /api/admin/users/:id`
- Dosen:
  - `GET /api/exams`
  - `POST /api/exams`
  - `PUT /api/exams/:id`
  - `DELETE /api/exams/:id`
  - `GET /api/questions`
  - `POST /api/questions`
  - `PUT /api/questions/:id`
  - `DELETE /api/questions/:id`
  - `GET /api/grading/exams/:exam_id/answers`
  - `PUT /api/grading/responses/:response_id/score`
  - `GET /api/exams/:exam_id/rekap-detail`
- Mahasiswa:
  - `POST /api/student/verify-token`
  - `POST /api/student/submit-exam`
  - `GET /api/student/history`

## Known Notes

- Semua tipe soal kecuali TIPE_4 sudah auto-grade (TIPE_1 & TIPE_2 instant, TIPE_3 via AI queue).
- Testing otomatis belum tersedia di `package.json`.
- Lihat `MULTIPLE_CHOICE_GUIDE.md` untuk dokumentasi lengkap multiple choice.
- Lihat `TEST_MULTIPLE_CHOICE.md` untuk test cases dan contoh scoring.
- Jalankan `node example_questions_seed.js` untuk seed contoh soal.
