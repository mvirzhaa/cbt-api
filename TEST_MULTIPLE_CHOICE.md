# Test Cases: Multiple Choice Scoring

## Test Case 1: TIPE_1 - Single Choice

### Setup
```json
{
  "tipe_soal": "TIPE_1",
  "kunci_jawaban": "B",
  "bobot_nilai": 10
}
```

### Test Scenarios

| Jawaban Mahasiswa | Expected Score | Status |
|-------------------|----------------|--------|
| "B"               | 10             | ✅ Benar |
| "A"               | 0              | ❌ Salah |
| "C"               | 0              | ❌ Salah |
| ""                | 0              | ❌ Kosong |
| "b" (lowercase)   | 10             | ✅ Case insensitive |

---

## Test Case 2: TIPE_2 - Multiple Choice (All Correct)

### Setup
```json
{
  "tipe_soal": "TIPE_2",
  "kunci_jawaban": "A,C,E",
  "bobot_nilai": 15
}
```

### Scenario: Semua Benar
```
Jawaban: "A,C,E"
Benar: 3, Salah: 0
Score: (3 - 0) / 3 × 15 = 15.0
```
**Expected: 15** ✅

---

## Test Case 3: TIPE_2 - Partial Correct

### Setup (sama seperti Test Case 2)

### Scenario: Sebagian Benar (Tidak Lengkap)
```
Jawaban: "A,C"
Benar: 2, Salah: 0
Score: (2 - 0) / 3 × 15 = 10.0
```
**Expected: 10.0** ✅

---

## Test Case 4: TIPE_2 - With Wrong Answers

### Setup (sama seperti Test Case 2)

### Scenario: Ada Jawaban Salah
```
Jawaban: "A,B,C"
Kunci: A,C,E
Benar: 2 (A,C), Salah: 1 (B)
Score: (2 - 1) / 3 × 15 = 5.0
```
**Expected: 5.0** ✅

---

## Test Case 5: TIPE_2 - All Wrong

### Setup (sama seperti Test Case 2)

### Scenario: Semua Salah
```
Jawaban: "B,D"
Kunci: A,C,E
Benar: 0, Salah: 2
Score: max(0, (0 - 2) / 3 × 15) = 0
```
**Expected: 0** ✅ (minimum 0)

---

## Test Case 6: TIPE_2 - More Wrong Than Right

### Setup (sama seperti Test Case 2)

### Scenario: Lebih Banyak Salah
```
Jawaban: "A,B,D" 
Kunci: A,C,E
Benar: 1 (A), Salah: 2 (B,D)
Score: max(0, (1 - 2) / 3 × 15) = 0
```
**Expected: 0** ✅ (minimum 0, karena hasil negatif)

---

## Test Case 7: TIPE_2 - Empty Answer

### Setup (sama seperti Test Case 2)

### Scenario: Tidak Dijawab
```
Jawaban: ""
Benar: 0, Salah: 0
Score: 0
```
**Expected: 0** ✅

---

## Test Case 8: TIPE_2 - Array Format

### Setup (sama seperti Test Case 2)

### Scenario: Format Array (dari frontend)
```javascript
Jawaban: ["A", "C", "E"]
// Backend akan convert ke Set dan proses sama
Benar: 3, Salah: 0
Score: (3 - 0) / 3 × 15 = 15.0
```
**Expected: 15.0** ✅

---

## Test Case 9: TIPE_2 - Duplicate Answers

### Setup (sama seperti Test Case 2)

### Scenario: Jawaban Duplikat
```
Jawaban: "A,A,C,C,E"
// Set akan otomatis remove duplikat → {A,C,E}
Benar: 3, Salah: 0
Score: (3 - 0) / 3 × 15 = 15.0
```
**Expected: 15.0** ✅

---

## Test Case 10: TIPE_2 - Case Insensitive

### Setup (sama seperti Test Case 2)

### Scenario: Lowercase Input
```
Jawaban: "a,c,e"
// Backend convert to uppercase → "A,C,E"
Benar: 3, Salah: 0
Score: (3 - 0) / 3 × 15 = 15.0
```
**Expected: 15.0** ✅

---

## Test Case 11: Mixed TIPE_1 & TIPE_2 in One Exam

### Setup Exam
```json
{
  "grading_type": "PER_SOAL",
  "questions": [
    {
      "id": 1,
      "tipe_soal": "TIPE_1",
      "kunci_jawaban": "B",
      "bobot_nilai": 10
    },
    {
      "id": 2,
      "tipe_soal": "TIPE_2",
      "kunci_jawaban": "A,C,E",
      "bobot_nilai": 15
    }
  ]
}
```

### Scenario: Submit Both Questions
```json
{
  "answers": {
    "1": "B",      // TIPE_1: correct
    "2": "A,C"     // TIPE_2: partial (2 out of 3)
  }
}
```

**Expected Scores:**
- Question 1: 10.0 (full score)
- Question 2: 10.0 (partial: 2/3 × 15)
- **Total: 20.0** ✅

### Calculation in `skor_pilgan_100`:
```
Max Pilgan = 10 + 15 = 25
Raw Pilgan = 10 + 10 = 20
skor_pilgan_100 = (20 / 25) × 100 = 80
```
**Expected: 80** ✅

---

## Test Case 12: PER_KATEGORI Grading Mode

### Setup Exam
```json
{
  "grading_type": "PER_KATEGORI",
  "bobot_pilgan": 60,
  "bobot_esai": 30,
  "bobot_upload": 10,
  "questions": [
    {
      "id": 1,
      "tipe_soal": "TIPE_1",
      "kunci_jawaban": "B",
      "bobot_nilai": 10
    },
    {
      "id": 2,
      "tipe_soal": "TIPE_2",
      "kunci_jawaban": "A,C",
      "bobot_nilai": 20
    },
    {
      "id": 3,
      "tipe_soal": "TIPE_3",
      "bobot_nilai": 30
    }
  ]
}
```

### Scenario: All Questions Answered
```json
{
  "answers": {
    "1": "B",      // TIPE_1: 10/10
    "2": "A,C",    // TIPE_2: 20/20 (all correct)
    "3": "AI akan grade ini..."  // TIPE_3: assume AI gives 24/30
  }
}
```

**Calculation:**
```
Pilgan (TIPE_1 + TIPE_2):
  - Max: 10 + 20 = 30
  - Obtained: 10 + 20 = 30
  - Ratio: 30/30 = 1.0
  - Final: 1.0 × 60 = 60

Esai (TIPE_3):
  - Max: 30
  - Obtained: 24 (from AI)
  - Ratio: 24/30 = 0.8
  - Final: 0.8 × 30 = 24

Total Score: 60 + 24 = 84
```
**Expected: 84.0** ✅

---

## Manual Testing Steps

### 1. Create Test Exam
```bash
POST /api/exams
{
  "kode_mk": "TIF001",
  "nama_ujian": "Test Multiple Choice",
  "grading_type": "PER_SOAL"
}
```

### 2. Seed Questions
```bash
node example_questions_seed.js
```

### 3. Submit Test Answers
```bash
POST /api/student/submit-exam
{
  "exam_id": 1,
  "answers": {
    "1": "C",           // TIPE_1: correct
    "2": "A,C,D",       // TIPE_2: all correct
    "3": "B,D",         // TIPE_2: all correct
    "4": "Essay answer..."  // TIPE_3: will be AI graded
  }
}
```

### 4. Check Score
```bash
GET /api/student/history
```

Expected `skor_pilgan_100`:
- Question 1: 10/10
- Question 2: 15/15
- Question 3: 10/10
- Total: 35/35 = **100** ✅

---

## Edge Cases to Test

1. ✅ **Whitespace handling**: `"A , C , E"` should work
2. ✅ **Empty string**: `""` should return 0
3. ✅ **Null/undefined**: Should be handled safely
4. ✅ **Invalid options**: `"Z,Y,X"` should all count as wrong
5. ✅ **Mixed valid/invalid**: `"A,Z,C"` (Z is invalid)
6. ✅ **Unicode/special chars**: Should be trimmed/ignored
7. ✅ **Very long array**: `"A,B,C,D,E"` (all selected)

---

## Performance Test

**Scenario:** 100 students submit exam with 50 questions (25 TIPE_1, 25 TIPE_2)

**Expected:**
- All TIPE_1 and TIPE_2 graded immediately
- No AI queue used (only TIPE_3 uses queue)
- Response time < 2 seconds per submission
- Database: 100 × 50 = 5000 records in `student_responses`
- All `status_penilaian` = 'selesai' for TIPE_1 and TIPE_2
