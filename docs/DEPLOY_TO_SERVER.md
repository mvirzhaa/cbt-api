# Deployment Guide - Update ke Server

## Step 1: Test Model di Local (Windows)

Sebelum deploy, test dulu model mana yang available:

```bash
# Di Windows (local)
node test_gemini_models.js
```

Output akan menunjukkan model mana yang bisa dipakai dengan API key Anda.

---

## Step 2: Upload Code ke Server

### Option A: Git Push (Recommended)

```bash
# Di Windows (local)
git add .
git commit -m "feat: add robust AI fallback and multiple choice support"
git push origin main
```

Lalu di server:

```bash
# Di Server (SSH)
cd /var/www/html/cbt-api
git pull origin main
```

### Option B: Manual Upload via SCP/SFTP

Upload file-file yang berubah:
- `services/aiService.js`
- `controllers/studentController.js`
- `services/gradingService.js`
- `controllers/gradingController.js`
- `test_gemini_models.js` (untuk testing)

---

## Step 3: Test Model di Server

```bash
# Di Server (SSH)
cd /var/www/html/cbt-api

# Test model availability
node test_gemini_models.js
```

**Contoh output yang bagus:**
```
✅ SUCCESS: gemini-1.5-flash-latest
✅ SUCCESS: gemini-1.5-pro
```

**Jika ada yang gagal:**
```
❌ FAILED: gemini-2.0-flash-exp
   Error: [404 Not Found] models/gemini-2.0-flash-exp is not found...
```

---

## Step 4: Update Model Priority (Jika Perlu)

Berdasarkan hasil test, edit `services/aiService.js`:

```javascript
// SEBELUM (default)
const MODEL_PRIORITY = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro"
];

// SESUDAH (sesuaikan dengan model yang available)
const MODEL_PRIORITY = [
    "gemini-1.5-flash-latest",   // Ganti dengan yang berhasil
    "gemini-1.5-flash",
    "gemini-1.5-pro"
];
```

---

## Step 5: Install Dependencies (Jika Belum)

```bash
# Di Server
cd /var/www/html/cbt-api
npm install
```

---

## Step 6: Restart PM2

```bash
# Di Server
pm2 restart cbt-skripsi-api

# Atau restart semua
pm2 restart all
```

---

## Step 7: Monitor Logs

```bash
# Monitor real-time
pm2 logs cbt-skripsi-api

# Atau specific untuk AI Worker
pm2 logs cbt-skripsi-api | grep "AI Worker"

# Hanya error
pm2 logs cbt-skripsi-api --err
```

**Yang harus Anda lihat (GOOD):**
```
[AI Worker] Mencoba model: gemini-1.5-flash (attempt 1/4)
[AI Worker] ✅ Berhasil dengan model: gemini-1.5-flash
[AI Worker] ✅ Selesai! ID: 123 | Skor: 85
```

**Jika masih error (BAD):**
```
[AI Worker] ❌ Error dengan model gemini-1.5-flash: 404 Not Found
[AI Worker] ❌ Semua model gagal setelah 4 percobaan
```

---

## Step 8: Test Submit Exam

### Via Postman/Thunder Client:

```bash
POST http://your-server.com/api/student/submit-exam
Content-Type: application/json
Authorization: Bearer <student_token>

{
  "exam_id": 1,
  "answers": {
    "1": "B",
    "2": "A,C",
    "3": "Ini jawaban esai untuk test AI grading"
  }
}
```

### Cek Log:

```bash
pm2 logs cbt-skripsi-api --lines 50
```

---

## Quick Fix untuk Error yang Anda Alami

Berdasarkan log error Anda:
```
❌ models/gemini-1.5-flash is not found for API version v1beta
❌ models/gemini-2.5-flash... [503 Service Unavailable]
```

### Solusi Cepat:

**1. Test model dulu:**
```bash
ssh root@your-server
cd /var/www/html/cbt-api
node test_gemini_models.js
```

**2. Update aiService.js dengan model yang available:**

Jika test menunjukkan `gemini-1.5-flash-latest` works:

```bash
# Edit file
nano services/aiService.js

# Ganti baris ~11-16 menjadi:
const MODEL_PRIORITY = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro"
];
```

**3. Restart:**
```bash
pm2 restart cbt-skripsi-api
pm2 logs cbt-skripsi-api
```

---

## Troubleshooting

### Problem: "Code lama masih jalan setelah git pull"

**Solution:**
```bash
# Clear require cache
pm2 delete cbt-skripsi-api
pm2 start index.js --name cbt-skripsi-api
```

### Problem: "Module not found"

**Solution:**
```bash
# Install dependencies
npm install
pm2 restart cbt-skripsi-api
```

### Problem: "All models still failing"

**Possible causes:**
1. **Invalid API Key** - Generate new key: https://aistudio.google.com/apikey
2. **No quota** - Check your quota: https://aistudio.google.com/
3. **Region blocked** - Try VPN or different region API key

**Solution:**
```bash
# Test API key dengan curl
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Test"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=YOUR_API_KEY"
```

If you get JSON response (not error), API key is valid.

### Problem: "503 Service Unavailable terus-menerus"

**Temporary solution:**
```bash
# Increase delay in aiService.js line ~165
const baseDelay = 10000; // 10 detik (dari 4 detik)
```

Then restart:
```bash
pm2 restart cbt-skripsi-api
```

---

## Verification Checklist

- [ ] `test_gemini_models.js` berhasil menemukan minimal 1 working model
- [ ] `aiService.js` sudah update dengan MODEL_PRIORITY yang benar
- [ ] `pm2 restart` sudah dijalankan
- [ ] Log menunjukkan `[AI Worker] ✅ Berhasil dengan model: ...`
- [ ] Submit exam dengan TIPE_3 berhasil masuk queue
- [ ] Score esai ter-update setelah beberapa detik/menit

---

## One-Line Deploy Command

```bash
# All-in-one command untuk server
cd /var/www/html/cbt-api && \
git pull origin main && \
npm install && \
node test_gemini_models.js && \
pm2 restart cbt-skripsi-api && \
pm2 logs cbt-skripsi-api --lines 30
```

---

## Emergency: Disable AI Grading Sementara

Jika AI benar-benar tidak bisa dipakai, temporary disable:

```javascript
// Di controllers/studentController.js line ~165
// COMMENT OUT AI queue:
/*
if (antreanEsaiAI.length > 0) {
    // ... code disabled
}
*/

// Semua TIPE_3 akan jadi manual grading oleh dosen
```

Restart:
```bash
pm2 restart cbt-skripsi-api
```

---

## Support

Jika masih error setelah semua langkah:
1. Screenshot output dari `node test_gemini_models.js`
2. Screenshot log `pm2 logs`
3. Share hasil dari:
```bash
cat services/aiService.js | head -20
pm2 info cbt-skripsi-api
```
