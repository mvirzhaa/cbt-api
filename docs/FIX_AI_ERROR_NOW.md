# 🚨 FIX AI ERROR SEKARANG - 5 MENIT

Error yang Anda alami:
```
❌ models/gemini-1.5-flash is not found for API version v1beta
❌ models/gemini-2.5-flash [503 Service Unavailable]
```

## Quick Fix (Copy-Paste Commands)

### 1️⃣ Upload Code Baru ke Server

**Di Windows (lokal):**
```bash
# Commit & push
git add .
git commit -m "fix: robust AI fallback"
git push origin main
```

**Di Server (SSH):**
```bash
cd /var/www/html/cbt-api
git pull origin main
```

---

### 2️⃣ Test Model Yang Available

```bash
cd /var/www/html/cbt-api
node test_gemini_models.js
```

Tunggu hasilnya... Cari baris dengan `✅ SUCCESS:`

**Contoh output bagus:**
```
✅ SUCCESS: gemini-1.5-flash-latest
✅ SUCCESS: gemini-1.5-pro
```

---

### 3️⃣ Edit aiService.js (Jika Perlu)

**Jika model yang SUCCESS beda dari default, edit:**

```bash
nano services/aiService.js
```

**Cari baris ~11-16, ganti dengan model yang SUCCESS:**

```javascript
// GANTI INI (sesuaikan dengan hasil test)
const MODEL_PRIORITY = [
    "gemini-1.5-flash-latest",  // ← Model pertama dari test yang ✅
    "gemini-1.5-pro"             // ← Model kedua dari test yang ✅
];
```

Save: `Ctrl+X` → `Y` → `Enter`

---

### 4️⃣ Restart PM2

```bash
pm2 restart cbt-skripsi-api
```

---

### 5️⃣ Monitor Log

```bash
pm2 logs cbt-skripsi-api --lines 50
```

**Harus muncul:** `[AI Worker] ✅ Berhasil dengan model: ...`

---

## ⚡ ONE-COMMAND FIX

Salin & jalankan di server:

```bash
cd /var/www/html/cbt-api && \
git pull origin main && \
node test_gemini_models.js && \
pm2 restart cbt-skripsi-api && \
echo "✅ Fix applied! Monitoring logs..." && \
pm2 logs cbt-skripsi-api --lines 30
```

---

## 🔍 Verify Fix Berhasil

Test submit exam dengan esai:

```bash
curl -X POST http://localhost:3000/api/student/submit-exam \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "exam_id": 1,
    "answers": {
      "1": "Ini jawaban esai untuk test AI"
    }
  }'
```

Lalu cek log:
```bash
pm2 logs cbt-skripsi-api | grep "AI Worker"
```

**GOOD (berhasil):**
```
[AI Worker] Mencoba model: gemini-1.5-flash-latest (attempt 1/4)
[AI Worker] ✅ Berhasil dengan model: gemini-1.5-flash-latest
[AI Worker] ✅ Selesai! ID: 123 | Skor: 85
```

**BAD (masih error):**
```
[AI Worker] ❌ Error dengan model ...
```

---

## 🆘 Jika Masih Error

### Problem A: Semua model 404

**API Key mungkin salah region. Coba:**

```bash

Jika error 404 juga, berarti API key perlu diganti.

**Generate API Key baru:**
1. Buka: https://aistudio.google.com/apikey
2. Create API Key
3. Update `.env`:
```bash
nano .env
# Edit GEMINI_API_KEY="new_key_here"
```
4. Restart: `pm2 restart cbt-skripsi-api`

---

### Problem B: Semua model 503 (overload)

**Temporary solution - increase delay:**

```bash
nano services/aiService.js
```

Cari baris ~167, ganti:
```javascript
const baseDelay = 10000; // Ubah dari 4000 ke 10000 (10 detik)
```

Restart:
```bash
pm2 restart cbt-skripsi-api
```

---

### Problem C: Code tidak update setelah git pull

**Force clean restart:**

```bash
pm2 delete cbt-skripsi-api
pm2 start index.js --name cbt-skripsi-api
pm2 save
```

---

## 📞 Need More Help?

Run diagnostic script:

```bash
cd /var/www/html/cbt-api
bash quick_fix_ai.sh
```

Atau baca: `AI_TROUBLESHOOTING.md`

---

## ✅ Checklist

- [ ] Code baru sudah di-pull ke server
- [ ] `test_gemini_models.js` menemukan minimal 1 model yang works
- [ ] `aiService.js` updated dengan model yang available
- [ ] PM2 sudah di-restart
- [ ] Log menunjukkan `✅ Berhasil dengan model`
- [ ] Submit exam berhasil masuk AI queue
- [ ] Score ter-update setelah beberapa detik

---

## 🎯 Expected Timeline

- **Upload & pull code:** 1 menit
- **Test models:** 30 detik - 1 menit
- **Edit & restart:** 30 detik
- **Verify:** 1 menit

**Total: ~3-5 menit** ⚡
