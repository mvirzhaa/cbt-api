# AI Service Troubleshooting Guide

## Common Errors & Solutions

### 1. Error 404: Model Not Found

**Error Message:**
```
[GoogleGenerativeAI Error]: models/gemini-1.5-flash is not found for API version v1beta
```

**Cause:** Model name tidak valid atau API version salah.

**Solution:**
✅ Sistem sekarang menggunakan **fallback models** otomatis:
1. `gemini-2.0-flash-exp` (tercepat, experimental)
2. `gemini-1.5-flash` (stable)
3. `gemini-1.5-flash-8b` (lebih ringan)
4. `gemini-1.5-pro` (paling stabil, lambat)

Jika satu model gagal, sistem otomatis mencoba model berikutnya.

---

### 2. Error 503: Service Unavailable / High Demand

**Error Message:**
```
[503 Service Unavailable] This model is currently experiencing high demand. 
Spikes in demand are usually temporary. Please try again later.
```

**Cause:** 
- Model sedang overload
- Terlalu banyak request simultan
- Server Gemini sedang maintenance

**Solution:**

✅ **Auto-Retry Logic:**
Sistem akan otomatis:
1. Retry maksimal **5 kali** per job
2. Switch ke model fallback jika tersedia
3. Exponential backoff delay: 4s, 6s, 8s, 10s, 12s
4. Skip job jika semua retry gagal (set skor = 0, dosen harus nilai manual)

✅ **Manual Actions:**
```bash
# 1. Cek queue status di log
pm2 logs cbt-api

# 2. Restart service jika stuck
pm2 restart cbt-api

# 3. Tambah delay antar request (edit aiService.js line ~160)
const baseDelay = 6000; // Ubah dari 4000 ke 6000 (6 detik)
```

---

### 3. Error 429: Rate Limit Exceeded

**Error Message:**
```
[429 Too Many Requests] Rate limit exceeded
```

**Cause:** Terlalu banyak request dalam waktu singkat.

**Gemini API Limits:**
- Free tier: **15 requests/minute**
- Paid tier: **60+ requests/minute**

**Solution:**

✅ **Sudah Diimplementasi:**
- Base delay: 4 detik antar request
- Exponential backoff saat retry
- Auto fallback ke model lain

✅ **Tingkatkan Limit:**
```bash
# Option 1: Tambah delay
const baseDelay = 5000; // 5 detik = 12 req/min (aman untuk free tier)

# Option 2: Upgrade ke paid tier
# https://ai.google.dev/pricing
```

---

### 4. AI Queue Stuck / Not Processing

**Symptoms:**
- Status ujian stuck di `MENUNGGU_VERIFIKASI`
- Skor esai tidak update
- Log tidak menampilkan `[AI Worker]`

**Diagnosis:**
```bash
# Cek log server
pm2 logs cbt-api --lines 100

# Cek apakah worker jalan
grep "AI Worker" /path/to/log/file
```

**Solution:**

1. **Restart Server:**
```bash
pm2 restart cbt-api
```

2. **Cek Environment Variable:**
```bash
# Pastikan GEMINI_API_KEY ada
echo $GEMINI_API_KEY

# Atau cek di .env file
cat .env | grep GEMINI_API_KEY
```

3. **Manual Trigger (Development):**
```javascript
// Tambahkan endpoint debug di routes/grading.js
router.post('/debug/process-queue', async (req, res) => {
    const aiService = require('../services/aiService');
    // Force trigger queue processing
    res.json({ message: 'Queue processing triggered' });
});
```

---

### 5. Invalid API Key

**Error Message:**
```
[400 Bad Request] API key not valid
```

**Solution:**

1. **Verify API Key:**
```bash
# Test API key dengan curl
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY"
```

2. **Generate New Key:**
- Go to: https://aistudio.google.com/apikey
- Create new API key
- Update `.env` file:
```env
GEMINI_API_KEY="your_new_api_key_here"
```

3. **Restart Server:**
```bash
pm2 restart cbt-api
```

---

## Monitoring & Logs

### Log Format Understanding

**Success:**
```
[AI Worker] Mencoba model: gemini-2.0-flash-exp (attempt 1/4)
[AI Worker] ✅ Berhasil dengan model: gemini-2.0-flash-exp
[AI Worker] ✅ Selesai! ID: 123 | Skor: 85
[AI Worker] exam_attempts skor_esai_100 updated: 85
```

**Retry:**
```
[AI Worker] ❌ Error dengan model gemini-2.0-flash-exp: 503 Service Unavailable
[AI Worker] ⏳ Menunggu 2 detik sebelum mencoba model berikutnya...
[AI Worker] Mencoba model: gemini-1.5-flash (attempt 2/4)
[AI Worker] ✅ Berhasil dengan model: gemini-1.5-flash
```

**Final Failure:**
```
[AI Worker] ❌ Semua model gagal setelah 4 percobaan
[AI Worker] ⚠️ Gagal menilai ID: 123, retry ke-5/5
[AI Worker] ❌ FINAL FAIL ID: 123 setelah 5 percobaan. Skip.
```

### Monitoring Script

```bash
#!/bin/bash
# monitor_ai.sh

while true; do
    echo "=== AI Queue Status $(date) ==="
    pm2 logs cbt-api --lines 50 | grep "AI Worker" | tail -10
    echo ""
    sleep 30
done
```

---

## Performance Optimization

### 1. Reduce Queue Size

Jika banyak soal esai dalam satu exam:
```javascript
// Opsi: Process multiple items concurrently (edit processQueue)
const CONCURRENT_JOBS = 2; // Process 2 jobs bersamaan

// Perhatikan rate limit!
// 2 concurrent × 15 req/min = 30 req/min needed (harus paid tier)
```

### 2. Model Selection Strategy

```javascript
// Priority: Speed → Stability
const MODEL_PRIORITY = [
    "gemini-2.0-flash-exp",  // Fastest, but experimental
    "gemini-1.5-flash",      // Good balance
    "gemini-1.5-flash-8b",   // Lighter, faster
    "gemini-1.5-pro"         // Most stable, slower
];
```

**Recommendations:**
- **Development:** Use `gemini-2.0-flash-exp` (fastest)
- **Production:** Use `gemini-1.5-flash` (stable + fast)
- **High Load:** Use `gemini-1.5-pro` (paling jarang error)

### 3. Caching Strategy (Future)

Untuk soal yang sama dengan jawaban mirip:
```javascript
// TODO: Implement simple caching
const gradeCache = new Map(); // { soalHash: { jawabanHash: skor } }
```

---

## Best Practices

### 1. Environment Setup
```env
# .env
GEMINI_API_KEY="your_api_key"

# Optional: Override default model priority
GEMINI_PRIMARY_MODEL="gemini-1.5-flash"
GEMINI_FALLBACK_MODEL="gemini-1.5-pro"
```

### 2. Error Alerting

Add webhook notification for final failures:
```javascript
if (job.retryCount > maxRetries) {
    // Send notification ke Slack/Discord/Email
    await notifyAdmin({
        type: 'AI_GRADING_FAILED',
        responseId: job.responseId,
        retries: job.retryCount
    });
}
```

### 3. Health Check Endpoint

```javascript
// routes/health.js
router.get('/health/ai', async (req, res) => {
    const testPrompt = "Test: 1+1=?";
    const result = await gradeWithAI("1+1", "2", "2");
    
    res.json({
        status: result !== null ? 'healthy' : 'unhealthy',
        currentModel: MODEL_PRIORITY[currentModelIndex],
        timestamp: new Date()
    });
});
```

---

## FAQ

**Q: Berapa lama waktu rata-rata untuk grade 1 esai?**
A: 2-5 detik (tergantung model dan panjang jawaban)

**Q: Apakah queue bisa handle 100 mahasiswa submit bersamaan?**
A: Ya, tapi akan memakan waktu:
- 100 soal esai × 4 detik delay = ~6.7 menit (optimal)
- Dengan retry: bisa 10-15 menit

**Q: Bagaimana cara prioritize certain jobs?**
A: Edit `addToQueue` untuk support priority:
```javascript
exports.addToQueue = (responseId, soal, kunci, jawaban, userId, examId, priority = 0) => {
    const job = { responseId, soal, kunci, jawaban, userId, examId, priority };
    
    // Insert based on priority
    if (priority > 0) {
        correctionQueue.unshift(job); // High priority di depan
    } else {
        correctionQueue.push(job); // Normal priority di belakang
    }
    
    processQueue();
};
```

**Q: Apakah bisa pakai AI lokal (offline)?**
A: Bisa, tapi perlu refactor:
- Ganti Gemini dengan Ollama/LM Studio
- Model: Llama 3, Mistral, atau Qwen
- Performance akan lebih lambat tanpa GPU

---

## Support

**Gemini API Documentation:**
- https://ai.google.dev/gemini-api/docs

**Get API Key:**
- https://aistudio.google.com/apikey

**Pricing:**
- https://ai.google.dev/pricing

**Status Page:**
- Check unofficial status: https://downdetector.com/status/google-ai/
