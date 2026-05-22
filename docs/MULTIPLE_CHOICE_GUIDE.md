# Panduan Multiple Choice - Frontend Integration

## Format Soal & Jawaban

### TIPE_1: Single Choice (Pilih 1)
**Pilihan:** A, B, C, D, E

**Format Kunci Jawaban di Database:**
```json
{
  "kunci_jawaban": "B"
}
```

**Format Jawaban dari Frontend:**
```json
{
  "answers": {
    "123": "B"
  }
}
```

### TIPE_2: Multiple Choice (Pilih > 1)
**Pilihan:** A, B, C, D, E (bisa pilih lebih dari 1)

**Format Kunci Jawaban di Database:**
```json
{
  "kunci_jawaban": "A,C,E"
}
```

**Format Jawaban dari Frontend (Option 1 - String):**
```json
{
  "answers": {
    "124": "A,C,E"
  }
}
```

**Format Jawaban dari Frontend (Option 2 - Array):**
```json
{
  "answers": {
    "124": ["A", "C", "E"]
  }
}
```

## Sistem Penilaian

### TIPE_1: Single Choice
- **Benar**: Skor penuh (sesuai bobot soal)
- **Salah**: 0

**Contoh:**
```
Bobot soal: 10
Kunci jawaban: "B"
Jawaban mahasiswa: "B" → Skor: 10
Jawaban mahasiswa: "A" → Skor: 0
```

### TIPE_2: Multiple Choice
Menggunakan **partial scoring** dengan formula:

```
skor = max(0, (benar - salah) / total_kunci) × bobot
```

**Penjelasan:**
- `benar` = jumlah pilihan yang dipilih DAN ada di kunci jawaban
- `salah` = jumlah pilihan yang dipilih tapi TIDAK ada di kunci jawaban
- `total_kunci` = jumlah pilihan yang ada di kunci jawaban

**Contoh 1: Semua Benar**
```
Kunci: A,C,E (3 pilihan)
Jawaban: A,C,E
Bobot: 10

benar = 3
salah = 0
skor = (3 - 0) / 3 × 10 = 10
```

**Contoh 2: Sebagian Benar**
```
Kunci: A,C,E (3 pilihan)
Jawaban: A,C (hanya 2 dipilih)
Bobot: 10

benar = 2
salah = 0
skor = (2 - 0) / 3 × 10 = 6.67
```

**Contoh 3: Ada Salah**
```
Kunci: A,C,E (3 pilihan)
Jawaban: A,B,C (B salah)
Bobot: 10

benar = 2 (A dan C)
salah = 1 (B tidak ada di kunci)
skor = (2 - 1) / 3 × 10 = 3.33
```

**Contoh 4: Lebih Banyak Salah**
```
Kunci: A,C,E (3 pilihan)
Jawaban: B,D (semua salah)
Bobot: 10

benar = 0
salah = 2
skor = max(0, (0 - 2) / 3) × 10 = 0 (minimal 0)
```

## Contoh Request Submit Exam

### JSON Format
```json
POST /api/student/submit-exam
Content-Type: application/json

{
  "exam_id": 5,
  "answers": {
    "101": "B",           // TIPE_1: single choice
    "102": "A,C,E",       // TIPE_2: multiple choice (string)
    "103": ["B", "D"],    // TIPE_2: multiple choice (array)
    "104": "Jawaban esai panjang...", // TIPE_3: esai
  }
}
```

### FormData Format (jika ada upload file)
```javascript
const formData = new FormData();
formData.append('exam_id', '5');
formData.append('answers[101]', 'B');           // TIPE_1
formData.append('answers[102]', 'A,C,E');       // TIPE_2
formData.append('answers[103]', 'B,D');         // TIPE_2
formData.append('answers[104]', 'Jawaban esai...'); // TIPE_3
formData.append('file_105', fileObject);        // TIPE_4: file upload
```

## Contoh UI Component (React/Vue)

### Single Choice (TIPE_1)
```jsx
<div className="question">
  <p>{question.isi_soal}</p>
  {question.question_options.map(option => (
    <label key={option.id}>
      <input
        type="radio"
        name={`question_${question.id}`}
        value={option.label_pilihan}
        onChange={(e) => setAnswer(question.id, e.target.value)}
      />
      {option.label_pilihan}. {option.teks_pilihan}
    </label>
  ))}
</div>
```

### Multiple Choice (TIPE_2)
```jsx
const [selectedOptions, setSelectedOptions] = useState([]);

const handleCheckbox = (value) => {
  setSelectedOptions(prev => 
    prev.includes(value)
      ? prev.filter(v => v !== value)
      : [...prev, value]
  );
};

// Saat submit, gabungkan jadi string
const answerString = selectedOptions.join(','); // "A,C,E"

<div className="question">
  <p>{question.isi_soal}</p>
  <p className="hint">Pilih lebih dari 1 jawaban yang benar</p>
  {question.question_options.map(option => (
    <label key={option.id}>
      <input
        type="checkbox"
        value={option.label_pilihan}
        checked={selectedOptions.includes(option.label_pilihan)}
        onChange={() => handleCheckbox(option.label_pilihan)}
      />
      {option.label_pilihan}. {option.teks_pilihan}
    </label>
  ))}
</div>
```

## Membuat Soal Multiple Choice via API

### Contoh Request
```json
POST /api/questions
Content-Type: application/json
Authorization: Bearer <dosen_token>

{
  "exam_id": 5,
  "tipe_soal": "TIPE_2",
  "cpmk": "CPMK-01",
  "isi_soal": "Manakah yang merupakan bahasa pemrograman backend?",
  "kunci_jawaban": "A,C,D",
  "bobot_nilai": 10,
  "question_options": [
    { "label_pilihan": "A", "teks_pilihan": "Node.js" },
    { "label_pilihan": "B", "teks_pilihan": "React" },
    { "label_pilihan": "C", "teks_pilihan": "Python" },
    { "label_pilihan": "D", "teks_pilihan": "PHP" },
    { "label_pilihan": "E", "teks_pilihan": "Vue.js" }
  ]
}
```

**Catatan Penting:**
- Untuk TIPE_2, `kunci_jawaban` harus format string dengan koma: `"A,C,D"`
- Pastikan `question_options` memiliki 5 pilihan (A-E)
- Label pilihan harus uppercase: A, B, C, D, E
