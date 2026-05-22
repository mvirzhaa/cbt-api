# Testing Checklist - Before Deploy

## ✅ Changes Made:

### 1. **Question Controller Fix** (`controllers/questionController.js`)
- ✅ Added proper validation for TIPE_2 (Multiple Choice)
- ✅ Added validation for TIPE_3 & TIPE_4 (no opsi_jawaban required)
- ✅ Added support for custom `bobot_nilai` and `cpmk` in create
- ✅ Fixed options creation for both TIPE_1 and TIPE_2
- ✅ Support 5 options (A-E) instead of 4 (A-D)

### 2. **AI Service Enhancement** (`services/aiService.js`)
- ✅ Added debug logging on module load
- ✅ Added extra debug info during grading attempts
- ✅ Added `clearQueue()` function
- ✅ Added `getQueueStatus()` function
- ✅ Already has correct MODEL_PRIORITY with working models

### 3. **New Endpoints** (`routes/grading.js`)
- ✅ `GET /api/grading/ai-queue/status` - Check queue status
- ✅ `POST /api/grading/ai-queue/clear` - Clear stuck queue (admin only)

---

## 🧪 Test Cases:

### Test 1: Create TIPE_1 (Single Choice)
```bash
POST /api/questions
Authorization: Bearer <dosen_token>
Content-Type: application/json

{
  "exam_id": 1,
  "tipe_soal": "TIPE_1",
  "cpmk": "CPMK-01",
  "isi_soal": "Apa kepanjangan dari HTTP?",
  "kunci_jawaban": "C",
  "bobot_nilai": 10,
  "opsi_jawaban": [
    "Hyperlink Text Transfer Protocol",
    "High Transfer Text Protocol",
    "Hypertext Transfer Protocol",
    "Hypertext Transmission Protocol",
    "High Text Transfer Protocol"
  ]
}
```

**Expected:** 201 Created, soal berhasil dibuat dengan 5 options (A-E)

---

### Test 2: Create TIPE_2 (Multiple Choice)
```bash
POST /api/questions
Authorization: Bearer <dosen_token>
Content-Type: application/json

{
  "exam_id": 1,
  "tipe_soal": "TIPE_2",
  "cpmk": "CPMK-02",
  "isi_soal": "Manakah yang merupakan bahasa backend? (Pilih semua yang benar)",
  "kunci_jawaban": "A,C,D",
  "bobot_nilai": 15,
  "opsi_jawaban": [
    "Node.js",
    "React",
    "Python",
    "PHP",
    "Vue.js"
  ]
}
```

**Expected:** 201 Created, soal berhasil dibuat dengan kunci jawaban comma-separated

---

### Test 3: Create TIPE_3 (Essay - AI Grading)
```bash
POST /api/questions
Authorization: Bearer <dosen_token>
Content-Type: application/json

{
  "exam_id": 1,
  "tipe_soal": "TIPE_3",
  "cpmk": "CPMK-03",
  "isi_soal": "Jelaskan perbedaan antara REST API dan GraphQL!",
  "kunci_jawaban": "REST API menggunakan multiple endpoints, GraphQL single endpoint dengan flexible queries",
  "bobot_nilai": 20
}
```

**Expected:** 201 Created, tanpa opsi_jawaban (tidak required)

---

### Test 4: Create TIPE_4 (File Upload)
```bash
POST /api/questions
Authorization: Bearer <dosen_token>
Content-Type: application/json

{
  "exam_id": 1,
  "tipe_soal": "TIPE_4",
  "cpmk": "CPMK-04",
  "isi_soal": "Upload file program kalkulator sederhana yang Anda buat",
  "bobot_nilai": 25
}
```

**Expected:** 201 Created, tanpa kunci_jawaban dan opsi_jawaban (keduanya optional)

---

### Test 5: Check AI Queue Status
```bash
GET /api/grading/ai-queue/status
Authorization: Bearer <dosen_token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "queueLength": 5,
    "isProcessing": true,
    "currentModelIndex": 0,
    "modelPriority": [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-pro"
    ]
  }
}
```

---

### Test 6: Clear Stuck Queue (Admin Only)
```bash
POST /api/grading/ai-queue/clear
Authorization: Bearer <admin_token>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Queue cleared. 5 jobs removed."
}
```

---

### Test 7: Submit Exam with All Types
```bash
POST /api/student/submit-exam
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "exam_id": 1,
  "answers": {
    "1": "C",                           // TIPE_1: Single choice
    "2": "A,C,D",                       // TIPE_2: Multiple choice
    "3": "REST uses multiple endpoints, GraphQL single endpoint"  // TIPE_3: Essay
  }
}
```

**Expected:** 
- TIPE_1 auto-graded immediately
- TIPE_2 auto-graded immediately with partial scoring
- TIPE_3 added to AI queue

Check logs should show:
```
[AI Worker] ➕ Job added to queue. Total queue: 1
[AI Worker] 🔍 DEBUG - MODEL_PRIORITY array: [ 'gemini-2.5-flash', ... ]
[AI Worker] Mencoba model: gemini-2.5-flash (attempt 1/4)
```

---

## 🚨 Known Issues to Monitor:

### Issue 1: Old Queue Jobs
**Symptom:** Error logs still showing `gemini-1.5-flash`
**Cause:** Old jobs in memory from before code update
**Solution:** 
1. Call `POST /api/grading/ai-queue/clear` (admin)
2. Or restart PM2: `pm2 restart cbt-skripsi-api`

### Issue 2: Gemini 503 Errors
**Symptom:** `[503 Service Unavailable] This model is currently experiencing high demand`
**Cause:** Free tier rate limit (15 req/min) or server overload
**Solution:** 
- System will auto-fallback to next model
- If all models fail, retry with exponential backoff
- Consider increasing `baseDelay` from 4s to 8s

### Issue 3: Frontend Sending Wrong Format
**Symptom:** 400 Bad Request when creating questions
**Cause:** Frontend sending array for `kunci_jawaban` in TIPE_2
**Solution:** Frontend must send string: `"A,C,D"` not `["A","C","D"]`

---

## 📊 Validation Rules Summary:

| Field | TIPE_1 | TIPE_2 | TIPE_3 | TIPE_4 |
|-------|--------|--------|--------|--------|
| `exam_id` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `tipe_soal` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `isi_soal` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `cpmk` | Optional (default: "CPMK-1") | Optional | Optional | Optional |
| `bobot_nilai` | Optional (default: 10) | Optional | Optional | Optional |
| `kunci_jawaban` | ✅ Required (single: "C") | ✅ Required (multiple: "A,C,E") | Optional (for rubric) | Optional |
| `opsi_jawaban` | ✅ Required (array, min 2) | ✅ Required (array, min 2) | ❌ Not needed | ❌ Not needed |

---

## 🔧 Rollback Plan (If Things Break):

### If question creation totally broken:
```bash
cd /var/www/html/cbt-api
git log --oneline -5
git revert <commit_hash>
pm2 restart cbt-skripsi-api
```

### If AI queue totally stuck:
```bash
# Clear queue via API
curl -X POST http://localhost:3003/api/grading/ai-queue/clear \
  -H "Authorization: Bearer <admin_token>"

# Or reset database
mysql -u root -p
USE cbt_kampus_db;
UPDATE student_responses SET skor = 0 WHERE status_penilaian = 'menunggu' AND skor IS NULL;
```

### Nuclear option:
```bash
pm2 stop cbt-skripsi-api
pm2 delete cbt-skripsi-api
pkill -f node
pm2 start index.js --name cbt-skripsi-api
```

---

## ✅ Deployment Checklist:

- [ ] Test all 4 question types creation locally
- [ ] Test AI queue status endpoint
- [ ] Test queue clear endpoint
- [ ] Verify logs show correct MODEL_PRIORITY on startup
- [ ] Test submit exam with all question types
- [ ] Monitor logs for any errors
- [ ] Backup database before deploy
- [ ] Deploy to server
- [ ] Clear old queue on server after deploy
- [ ] Test on production
- [ ] Monitor for 30 minutes

---

## 📝 Commit Message (When Ready):

```
fix: comprehensive question controller and AI queue improvements

Question Controller:
- Add proper validation for all 4 question types
- Support TIPE_2 multiple choice with 5 options (A-E)
- Add custom bobot_nilai and cpmk support
- Fix validation logic - TIPE_3/TIPE_4 don't need opsi_jawaban

AI Service:
- Add queue management functions (clearQueue, getQueueStatus)
- Add detailed debug logging
- Improve tracking of queue processing

New Endpoints:
- GET /api/grading/ai-queue/status - Monitor queue
- POST /api/grading/ai-queue/clear - Clear stuck queue (admin)

Fixes:
- Resolve 400 Bad Request when creating non-multiple-choice questions
- Provide tools to clear stuck AI queue jobs
- Better observability for debugging AI issues
```
