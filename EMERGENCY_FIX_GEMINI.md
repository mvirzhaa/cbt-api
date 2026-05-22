# 🚨 EMERGENCY FIX - Gemini 404 All Models

## Problem
Semua model Gemini return 404. Kemungkinan:
1. API key region restricted
2. SDK version issue  
3. Model names changed

## Solution 1: Update SDK Version (RECOMMENDED)

```bash
# Di server
cd /var/www/html/cbt-api
npm install @google/generative-ai@latest
pm2 restart cbt-skripsi-api
```

## Solution 2: Test Direct API Call

```bash
# Test v1 API
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Test: 1+1"}]}]}' \
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY"

# Test v1beta API  
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Test: 1+1"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY"
```

Ganti `YOUR_API_KEY` dengan key Anda.

**Expected:** JSON response with answer

**If 404:** API key bermasalah atau region restricted

## Solution 3: Generate NEW API Key

**CRITICAL:** API key lama mungkin restricted/deprecated

1. **Go to:** https://aistudio.google.com/apikey
2. **Delete old key** (optional)
3. **Create NEW API key**
4. **Update .env:**
```bash
nano .env
# Update: GEMINI_API_KEY="new_key_here"
```
5. **Restart:**
```bash
pm2 restart cbt-skripsi-api
```

## Solution 4: Try models/ Prefix

Edit `services/aiService.js` line 9-14:

```javascript
const MODEL_PRIORITY = [
    "models/gemini-1.5-flash",      // Add models/ prefix
    "models/gemini-1.5-pro",
    "models/gemini-pro"
];
```

## Solution 5: Fallback to OpenAI (Alternative)

Jika Gemini benar-benar tidak bisa, pakai OpenAI:

### Install OpenAI SDK:
```bash
npm install openai
```

### Create new file: `services/aiServiceOpenAI.js`
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const gradeWithAI = async (soal, kunciJawaban, jawabanMhs) => {
    const prompt = `Evaluasi jawaban mahasiswa IT.
Soal: ${soal}
Kunci: ${kunciJawaban || 'N/A'}
Jawaban: ${jawabanMhs}

Berikan nilai 0-100 (HANYA ANGKA):`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 10
        });
        
        const text = response.choices[0].message.content;
        const match = text.match(/\d+/);
        return match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 0;
    } catch (error) {
        console.error("OpenAI Error:", error.message);
        return null;
    }
};

module.exports = { gradeWithAI };
```

### Update studentController.js:
```javascript
// Ganti import
// const aiService = require('../services/aiService');
const aiService = require('../services/aiServiceOpenAI');
```

### Add to .env:
```env
OPENAI_API_KEY="sk-..."
```

**Cost:** ~$0.0015 per grading (very cheap)

## Solution 6: Temporary Disable AI Grading

**EMERGENCY ONLY - Manual grading by dosen:**

Edit `controllers/studentController.js` line ~164:

```javascript
// COMMENT OUT AI queue
/*
if (antreanEsaiAI.length > 0) {
    // ... disabled
}
*/
```

All TIPE_3 akan status `menunggu` untuk dosen nilai manual.

## Solution 7: Check API Key Quota

Go to: https://aistudio.google.com/

Check:
- ❌ **Quota exceeded?** → Wait 24h or upgrade
- ❌ **Key revoked?** → Generate new key
- ❌ **No access?** → Try different Google account

## Testing After Fix

```bash
# Test 1: Direct API test
node test_gemini_direct.js

# Test 2: SDK test
node test_gemini_models.js

# Test 3: Full integration test
curl -X POST http://localhost:3000/api/student/submit-exam \
  -H "Authorization: Bearer TOKEN" \
  -d '{"exam_id":1,"answers":{"1":"Test esai"}}'

# Test 4: Monitor logs
pm2 logs | grep "AI Worker"
```

## Decision Tree

```
API Key valid? 
├─ NO → Generate new key (Solution 3)
└─ YES → SDK updated?
    ├─ NO → Update SDK (Solution 1)
    └─ YES → Test direct API (Solution 2)
        ├─ Works → Model name issue (Solution 4)
        └─ Fails → Switch to OpenAI (Solution 5)
                   or Disable AI (Solution 6)
```

## Contact Info

- **Gemini Support:** https://ai.google.dev/gemini-api/docs
- **OpenAI Pricing:** https://openai.com/pricing
- **Alternative:** Use Claude API, Ollama (local), or manual grading

---

## Quick Commands Summary

```bash
# Update SDK
npm install @google/generative-ai@latest && pm2 restart cbt-skripsi-api

# Test direct
node test_gemini_direct.js

# New API key
nano .env  # Update GEMINI_API_KEY
pm2 restart cbt-skripsi-api

# Monitor
pm2 logs cbt-skripsi-api --lines 50 | grep "AI Worker"
```
