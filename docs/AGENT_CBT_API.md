# Agent Guide — CBT API
# Integrasi dengan TIAS Backend & TIAS Mobile

## Konteks Sistem Ini

Kamu adalah agent yang bekerja pada sistem **CBT API** — backend ujian berbasis komputer yang dibangun dengan:
- **Node.js + Express.js**
- **Prisma ORM + MySQL**
- **JWT untuk autentikasi**
- Arsitektur sebagian besar monolitik di `index.js`, dengan beberapa controller terpisah di `controllers/`

Sistem ini akan diintegrasikan dengan **TIAS Backend** dan **TIAS Mobile** agar mahasiswa bisa mengerjakan ujian langsung dari aplikasi mobile TIAS tanpa login ulang (SSO).

---

## Peranmu dalam Integrasi Ini

CBT API adalah **mesin ujian utama**. Tugasmu:
1. Menerima request SSO dari TIAS Backend dan menerbitkan CBT Token
2. Menyediakan endpoint ujian yang bisa diakses TIAS Mobile menggunakan CBT Token tersebut

**Yang TIDAK perlu diubah:** semua endpoint existing (dosen buat ujian, tambah soal, grading, rekap). Semua itu tetap dipakai dosen melalui website CBT yang sudah ada.

---

## Alur Komunikasi

```
TIAS Backend
  │
  └─► POST /api/auth/external-login   ← endpoint BARU yang kamu buat
        │  validasi shared_secret
        │  cari atau buat user berdasarkan email
        └─► kembalikan CBT JWT Token ke TIAS Backend

TIAS Mobile (setelah dapat CBT Token dari TIAS Backend)
  │
  ├─► GET  /api/student/exams              ← pastikan endpoint ini ada
  ├─► POST /api/student/verify-token       ← pastikan endpoint ini ada
  ├─► GET  /api/exams/:id/questions        ← pastikan endpoint ini ada
  ├─► POST /api/student/submit-exam        ← pastikan endpoint ini ada
  └─► GET  /api/student/result/:exam_id   ← pastikan endpoint ini ada
```

---

## Perubahan yang Harus Dilakukan

### PERUBAHAN 1 — Tambah Kolom `nim` di Prisma Schema

File: `prisma/schema.prisma`

Temukan model `Users`, tambahkan kolom `nim`:

```prisma
model Users {
  id        Int       @id @default(autoincrement())
  nim       String?   @unique   // ← TAMBAHKAN BARIS INI
  nama      String?
  email     String    @unique
  password  String
  role      String    @default("Mahasiswa")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // Semua relasi yang sudah ada — JANGAN DIUBAH
  Student_responses Student_responses[]
}
```

Setelah edit schema, jalankan migrasi:

```bash
npx prisma migrate dev --name add_nim_to_users
```

Verifikasi:
```bash
npx prisma studio
# Buka tabel Users, pastikan kolom nim sudah ada
```

---

### PERUBAHAN 2 — Tambah Variabel Environment

File: `.env`

```env
# Sudah ada — JANGAN DIUBAH
DATABASE_URL="mysql://..."
JWT_SECRET="existing_secret"

# TAMBAHKAN INI
# Generate dengan: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
TIAS_SHARED_SECRET="string_random_minimal_64_karakter"
```

> ⚠️ Nilai `TIAS_SHARED_SECRET` harus **identik** dengan nilai `TIAS_CBT_SHARED_SECRET` di `.env` TIAS Backend. Koordinasikan nilainya dengan agent TIAS Backend.

---

### PERUBAHAN 3 — Tambah Fungsi `externalLogin` di Controller

File: `controllers/authController.js`

Tambahkan fungsi ini **sebelum** `module.exports`:

```javascript
const externalLogin = async (req, res) => {
  try {
    const { email, nama, nim, shared_secret } = req.body;

    // Validasi field wajib
    if (!email || !shared_secret) {
      return res.status(400).json({
        success: false,
        message: 'Field email dan shared_secret wajib diisi.'
      });
    }

    // Validasi shared secret — penjaga keamanan endpoint ini
    if (shared_secret !== process.env.TIAS_SHARED_SECRET) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    // Cari atau buat user berdasarkan email
    let user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      // Auto-provisioning: buat akun CBT baru dari data TIAS
      user = await prisma.users.create({
        data: {
          email,
          nama: nama || email,
          nim: nim || null,
          // Password acak karena login hanya via SSO
          password: await require('bcryptjs').hash(
            require('crypto').randomBytes(32).toString('hex'),
            10
          ),
          role: 'Mahasiswa',
        }
      });
    } else {
      // Update nim jika belum ada
      if (!user.nim && nim) {
        user = await prisma.users.update({
          where: { id: user.id },
          data: { nim }
        });
      }
    }

    // Terbitkan CBT JWT Token
    const token = require('jsonwebtoken').sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: {
        token,
        user: { id: user.id, nama: user.nama, email: user.email, role: user.role }
      }
    });

  } catch (error) {
    console.error('[externalLogin Error]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
```

Tambahkan ke `module.exports`:

```javascript
module.exports = {
  register,   // sudah ada
  login,      // sudah ada
  externalLogin,  // ← TAMBAHKAN
};
```

---

### PERUBAHAN 4 — Daftarkan Route External Login

Temukan file route auth (bisa `routes/auth.js` atau langsung `index.js`).

Jika menggunakan file route terpisah:
```javascript
const { externalLogin } = require('../controllers/authController');

// Endpoint ini TIDAK pakai authMiddleware — auth via shared_secret
router.post('/auth/external-login', externalLogin);
```

Jika langsung di `index.js`:
```javascript
const { externalLogin } = require('./controllers/authController');
app.post('/api/auth/external-login', externalLogin);
```

---

### PERUBAHAN 5 — Pastikan Endpoint Student Exam Tersedia

Verifikasi semua endpoint berikut sudah ada di `index.js` atau controller:

```
GET  /api/student/exams
POST /api/student/verify-token
GET  /api/exams/:id/questions
POST /api/student/submit-exam
GET  /api/student/result/:exam_id
```

Jika `GET /api/student/exams` belum ada, tambahkan di `index.js`:

```javascript
app.get('/api/student/exams', verifyToken, async (req, res) => {
  try {
    const exams = await prisma.exams.findMany({
      where: { is_active: true },
      select: {
        id: true,
        nama_ujian: true,
        mata_kuliah: true,
        durasi: true,
        start_time: true,
        end_time: true,
      },
      orderBy: { created_at: 'desc' }
    });
    return res.json({ success: true, data: exams });
  } catch (error) {
    console.error('[Get Student Exams]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});
```

> ⚠️ Sesuaikan nama field (`is_active`, `nama_ujian`, dll) dengan nama kolom aktual di `schema.prisma` kamu.

---

## Cara Test Endpoint Baru

```bash
# 1. Jalankan CBT API
npm run dev

# 2. Test external login
curl -X POST http://localhost:3001/api/auth/external-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@mahasiswa.com",
    "nama": "Budi Santoso",
    "nim": "221106043001",
    "shared_secret": "ISI_DENGAN_TIAS_SHARED_SECRET"
  }'

# Response yang diharapkan:
# { "success": true, "data": { "token": "eyJ...", "user": {...} } }

# 3. Test daftar ujian dengan token yang didapat
curl -X GET http://localhost:3001/api/student/exams \
  -H "Authorization: Bearer TOKEN_DARI_STEP_2"
```

---

## Checklist Sebelum Selesai

- [ ] `nim String? @unique` ditambahkan di model `Users` pada `schema.prisma`
- [ ] `npx prisma migrate dev --name add_nim_to_users` berhasil dijalankan
- [ ] Fungsi `externalLogin` ditambahkan di `authController.js`
- [ ] `externalLogin` ada di `module.exports`
- [ ] Endpoint `POST /api/auth/external-login` terdaftar di route
- [ ] `TIAS_SHARED_SECRET` ditambahkan di `.env`
- [ ] Endpoint `GET /api/student/exams` tersedia dan berfungsi
- [ ] Test `curl` external login menghasilkan CBT Token
- [ ] `.env` **tidak** di-commit ke Git
