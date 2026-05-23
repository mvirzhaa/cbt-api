# Performance Optimization Guide - CBT API

## 🔥 Current Problems

### 1. **RAM Usage Tinggi**
- **Cause:** In-memory queue (`correctionQueue = []`) menyimpan semua pending jobs di RAM
- **Impact:** Server lambat, crash saat banyak mahasiswa submit bersamaan
- **Evidence:** Old jobs masih di-process setelah restart

### 2. **Excessive DB Queries**
- **Cause:** Recalculation `exam_attempts` setiap 1 soal selesai digrade
- **Impact:** DB overhead tinggi, query lambat
- **Example:** 100 mahasiswa × 5 soal esai = 500 recalculation queries

### 3. **No Queue Persistence**
- **Cause:** Queue hilang saat server restart/crash
- **Impact:** Jobs yang sedang diproses hilang, harus submit ulang

---

## 🚀 SOLUTION ROADMAP

### TAHAP 1: IMMEDIATE FIXES (No Dependencies - Hari Ini)

#### Fix 1A: Remove Per-Question Recalculation

**Problem:** Setiap 1 soal selesai → query all responses → recalculate → update DB

**Solution:** Only update individual `student_responses.skor`, skip recalculation

**Implementation:**

Edit `services/aiService.js` line 115-142, **COMMENT OUT** recalculation:

```javascript
// Line ~105-145
if (skorAI !== null) {
    await prisma.student_responses.update({
        where: { id: job.responseId },
        data: { skor: skorAI }
    });
    console.log(`[AI Worker] ✅ Selesai! ID: ${job.responseId} | Skor: ${skorAI}`);

    /* DISABLED: Recalculation moved to dosen verification
    // 🆕 Recalculate skor_esai_100 di exam_attempts
    try {
        const allResponses = await prisma.student_responses.findMany({...});
        // ... recalculation logic ...
        await prisma.exam_attempts.updateMany({...});
    } catch (attemptErr) {
        console.error('❌ Gagal update exam_attempts:', attemptErr.message);
    }
    */
    
    // Reset retry count jika berhasil
    if (job.retryCount) delete job.retryCount;
}
```

**Benefit:** 
- 80% reduction in DB queries
- Faster AI processing
- Less RAM usage

**Tradeoff:** 
- `exam_attempts.skor_esai_100` not updated until dosen verifies
- Need batch recalculation endpoint

---

#### Fix 1B: Add Max Queue Size Limit

**Problem:** Queue bisa grow tak terbatas, makan RAM

**Solution:** Limit queue size, reject new jobs if full

**Implementation:**

Edit `services/aiService.js` line ~17-20:

```javascript
// Add constants
const MAX_QUEUE_SIZE = 1000; // Max 1000 pending jobs
const correctionQueue = [];
let isProcessing = false;
let currentModelIndex = 0;
let rejectedJobsCount = 0; // Track rejected jobs

// Update addToQueue function
exports.addToQueue = (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    // Check queue size limit
    if (correctionQueue.length >= MAX_QUEUE_SIZE) {
        rejectedJobsCount++;
        console.error(`[AI Worker] ⚠️ Queue FULL! Rejected job ${responseId}. Total rejected: ${rejectedJobsCount}`);
        
        // Set skor = 0 immediately untuk manual grading
        prisma.student_responses.update({
            where: { id: responseId },
            data: { skor: 0, status_penilaian: 'menunggu' }
        }).catch(err => console.error('Failed to set fallback score:', err));
        
        return false; // Indicate job rejected
    }
    
    correctionQueue.push({ responseId, soal, kunciJawaban, jawabanMhs, userId, examId });
    console.log(`[AI Worker] ➕ Job added to queue. Total queue: ${correctionQueue.length}/${MAX_QUEUE_SIZE}`);
    processQueue();
    return true;
};
```

**Benefit:**
- Prevent RAM exhaustion
- Graceful degradation (fallback to manual grading)

---

#### Fix 1C: Add Job Expiry (TTL)

**Problem:** Old jobs stuck di queue selamanya

**Solution:** Auto-expire jobs older than 1 hour

```javascript
// Add timestamp to jobs
exports.addToQueue = (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    if (correctionQueue.length >= MAX_QUEUE_SIZE) return false;
    
    correctionQueue.push({
        responseId, soal, kunciJawaban, jawabanMhs, userId, examId,
        createdAt: Date.now(), // Add timestamp
        retryCount: 0
    });
    
    processQueue();
    return true;
};

// In processQueue, check expiry
const processQueue = async () => {
    if (isProcessing || correctionQueue.length === 0) return;
    isProcessing = true;
    
    const ONE_HOUR = 60 * 60 * 1000;
    
    while (correctionQueue.length > 0) {
        const job = correctionQueue.shift();
        
        // Check if job expired
        const age = Date.now() - job.createdAt;
        if (age > ONE_HOUR) {
            console.log(`[AI Worker] ⏰ Job ${job.responseId} expired (age: ${Math.round(age/1000/60)} min). Skipping.`);
            continue; // Skip expired job
        }
        
        // Process job...
    }
    
    isProcessing = false;
};
```

**Benefit:**
- Auto-clean old jobs
- Prevent infinite retry loops

---

### TAHAP 2: DATABASE-BACKED QUEUE (1-2 Hari)

**Goal:** Replace in-memory queue with database table

#### Step 1: Create Queue Table

```sql
-- Migration: add ai_queue table
CREATE TABLE ai_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  response_id INT NOT NULL,
  user_id INT NOT NULL,
  exam_id INT NOT NULL,
  soal TEXT NOT NULL,
  kunci_jawaban TEXT,
  jawaban_mhs TEXT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);
```

#### Step 2: Replace addToQueue

```javascript
exports.addToQueue = async (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    await prisma.ai_queue.create({
        data: {
            response_id: responseId,
            user_id: userId,
            exam_id: examId,
            soal,
            kunci_jawaban: kunciJawaban,
            jawaban_mhs: jawabanMhs,
            status: 'pending'
        }
    });
    
    console.log(`[AI Worker] ➕ Job added to DB queue`);
    processQueue(); // Trigger worker
};
```

#### Step 3: Replace processQueue

```javascript
const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;
    
    while (true) {
        // Get next pending job
        const job = await prisma.ai_queue.findFirst({
            where: {
                status: 'pending',
                retry_count: { lt: 5 }
            },
            orderBy: { created_at: 'asc' }
        });
        
        if (!job) break; // No more jobs
        
        // Mark as processing
        await prisma.ai_queue.update({
            where: { id: job.id },
            data: { status: 'processing' }
        });
        
        try {
            const skorAI = await gradeWithAI(job.soal, job.kunci_jawaban, job.jawaban_mhs);
            
            if (skorAI !== null) {
                // Update score
                await prisma.student_responses.update({
                    where: { id: job.response_id },
                    data: { skor: skorAI }
                });
                
                // Mark job completed
                await prisma.ai_queue.update({
                    where: { id: job.id },
                    data: { status: 'completed' }
                });
            } else {
                // Mark failed, increment retry
                await prisma.ai_queue.update({
                    where: { id: job.id },
                    data: {
                        status: 'pending',
                        retry_count: { increment: 1 },
                        error_message: 'AI grading failed'
                    }
                });
            }
        } catch (error) {
            await prisma.ai_queue.update({
                where: { id: job.id },
                data: {
                    status: 'failed',
                    error_message: error.message
                }
            });
        }
        
        await new Promise(r => setTimeout(r, 4000)); // Rate limit
    }
    
    isProcessing = false;
};
```

**Benefits:**
- ✅ Queue persists across restarts
- ✅ Easy to monitor (SELECT * FROM ai_queue)
- ✅ Can process from multiple servers
- ✅ Auto-retry built-in

**Tradeoffs:**
- Database I/O overhead (minimal)
- Requires migration

---

### TAHAP 3: REDIS + BULLMQ (3-5 Hari - Production Grade)

**Best Solution for High Load**

#### Prerequisites

```bash
# Install Redis
apt update
apt install redis-server
systemctl enable redis-server
systemctl start redis-server

# Install BullMQ
npm install bullmq ioredis
```

#### Implementation

**File: `services/aiQueueBull.js`** (NEW)

```javascript
const { Queue, Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_PRIORITY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-pro"];

// Create queue
const aiQueue = new Queue('ai-grading', {
    connection: {
        host: 'localhost',
        port: 6379
    },
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 4000
        },
        removeOnComplete: 100, // Keep last 100 completed
        removeOnFail: 1000      // Keep last 1000 failed
    }
});

// Add to queue
exports.addToQueue = async (responseId, soal, kunciJawaban, jawabanMhs, userId, examId) => {
    await aiQueue.add('grade-essay', {
        responseId,
        soal,
        kunciJawaban,
        jawabanMhs,
        userId,
        examId
    });
    
    console.log(`[BullMQ] ➕ Job ${responseId} added to queue`);
};

// Worker process
const worker = new Worker('ai-grading', async (job) => {
    const { responseId, soal, kunciJawaban, jawabanMhs } = job.data;
    
    console.log(`[BullMQ] Processing job ${job.id} - Response ${responseId}`);
    
    // Try each model
    for (const modelName of MODEL_PRIORITY) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = `Grade this answer (0-100 only): ${jawabanMhs}`;
            
            const result = await model.generateContent(prompt);
            const score = parseInt(result.response.text().match(/\d+/)?.[0] || 0);
            
            // Update score
            await prisma.student_responses.update({
                where: { id: responseId },
                data: { skor: score }
            });
            
            console.log(`[BullMQ] ✅ Job ${job.id} completed. Score: ${score}`);
            return { score, model: modelName };
            
        } catch (error) {
            console.log(`[BullMQ] Model ${modelName} failed: ${error.message}`);
            continue; // Try next model
        }
    }
    
    throw new Error('All models failed');
}, {
    connection: {
        host: 'localhost',
        port: 6379
    },
    concurrency: 5, // Process 5 jobs simultaneously
    limiter: {
        max: 15,      // Max 15 jobs
        duration: 60000 // per 60 seconds (respects Gemini rate limit)
    }
});

worker.on('completed', job => {
    console.log(`[BullMQ] ✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[BullMQ] ❌ Job ${job.id} failed: ${err.message}`);
});

// Queue status
exports.getQueueStatus = async () => {
    const waiting = await aiQueue.getWaitingCount();
    const active = await aiQueue.getActiveCount();
    const completed = await aiQueue.getCompletedCount();
    const failed = await aiQueue.getFailedCount();
    
    return { waiting, active, completed, failed };
};

// Clear queue
exports.clearQueue = async () => {
    await aiQueue.obliterate({ force: true });
    console.log('[BullMQ] Queue cleared');
};
```

**Benefits:**
- ✅ **Distributed:** Multiple servers can process same queue
- ✅ **Persistent:** Redis persists data
- ✅ **Rate Limiting:** Built-in (15 req/min)
- ✅ **Concurrency:** Process 5 jobs at once
- ✅ **Monitoring:** Bull Board UI available
- ✅ **Auto-retry:** Exponential backoff
- ✅ **Memory Efficient:** Jobs stored in Redis, not RAM

---

## 📊 Performance Comparison

| Solution | RAM Usage | DB Load | Persistence | Scalability | Complexity |
|----------|-----------|---------|-------------|-------------|------------|
| **Current (In-Memory)** | ❌ High | ❌ High | ❌ No | ❌ Single | ✅ Low |
| **Fix 1 (Optimized)** | ⚠️ Medium | ✅ Low | ❌ No | ❌ Single | ✅ Low |
| **Tahap 2 (DB Queue)** | ✅ Low | ⚠️ Medium | ✅ Yes | ⚠️ Limited | ⚠️ Medium |
| **Tahap 3 (Redis+BullMQ)** | ✅ Low | ✅ Low | ✅ Yes | ✅ Multi-Server | ⚠️ Medium |

---

## 🎯 RECOMMENDATION

### For Immediate Relief (Today):
✅ **Implement Fix 1A, 1B, 1C** - No dependencies, quick wins

### For Medium Term (This Week):
✅ **Implement Tahap 2 (DB Queue)** - Better than current, no new dependencies

### For Production (Next Sprint):
✅ **Implement Tahap 3 (BullMQ)** - Best solution, industry standard

---

## 🛠️ Alternative Solutions

### Option A: Disable AI Grading Temporarily
```javascript
// In controllers/studentController.js
// Comment out AI queue trigger
/*
if (antreanEsaiAI.length > 0) {
    // ... AI queue disabled
}
*/
```
All TIPE_3 akan manual grading by dosen.

### Option B: Batch Processing
Process AI grading once per hour instead of real-time:
```bash
# Cron job: setiap jam
0 * * * * curl -X POST http://localhost:3000/api/admin/process-ai-queue
```

### Option C: External Service
Use third-party grading service (OpenAI GPT-3.5 Turbo):
- Faster API
- Better rate limits
- ~$0.002 per grading

---

## 📞 Implementation Priority

1. **TODAY:** Fix 1A (remove recalculation) - 30 min
2. **TODAY:** Fix 1B (max queue size) - 15 min  
3. **TODAY:** Fix 1C (TTL) - 15 min
4. **THIS WEEK:** Tahap 2 (DB queue) - 4 hours
5. **NEXT SPRINT:** Tahap 3 (BullMQ) - 1-2 days

---

## 🧪 Testing

After each fix, monitor:
```bash
# RAM usage
free -h

# Queue size
curl http://localhost:3000/api/grading/ai-queue/status

# DB connections
mysqladmin -u root -p processlist

# Response time
time curl -X POST http://localhost:3000/api/student/submit-exam -d {...}
```

---

**Last Updated:** 2026-05-23
**Next Review:** After implementing Tahap 2
