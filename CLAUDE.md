# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RESTful API backend untuk sistem Computer Based Test (CBT) dengan role-based access control (super_admin, admin, dosen, mahasiswa). Sistem ini menggunakan Gemini AI untuk auto-grading esai dengan background queue processing.

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5.x
- **Database**: MySQL + Prisma ORM
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **AI Integration**: Google Generative AI (Gemini 2.5-flash)
- **File Upload**: Multer

## Essential Commands

```bash
# Setup database
npx prisma generate
npx prisma migrate dev

# Run server
node index.js

# Seed initial data (if needed)
node seed.js
```

## Environment Variables Required

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
JWT_SECRET="your_secure_secret"
PORT=3000
GEMINI_API_KEY="your_gemini_api_key"
TIAS_SHARED_SECRET="integration_key"  # Optional: for TIAS integration
```

## Core Architecture

### Question Types (Tipe Soal)
- **TIPE_1**: Pilihan ganda single choice (5 options A-E, pilih 1, auto-graded immediately)
- **TIPE_2**: Pilihan ganda multiple choice (5 options A-E, pilih lebih dari 1, auto-graded with partial scoring)
- **TIPE_3**: Esai (AI-graded via background queue using Gemini)
- **TIPE_4**: File upload (manual grading by dosen)

### Auto-Grading System Flow

**Multiple Choice (TIPE_1 & TIPE_2)** - Immediate grading:
- **TIPE_1**: Single choice - full score if correct, 0 if wrong
- **TIPE_2**: Multiple choice - partial scoring formula: `max(0, (correct - wrong) / total_keys) * bobot`
  - Answer format: `"A,B,C"` or `["A","B","C"]`
  - Key format in DB: `"A,B,C"`
  - Full score if all correct and no wrong answers
  - Partial score based on proportion of correct answers minus wrong answers
  - Minimum score is 0

**AI Grading (TIPE_3)** - Background queue:
1. **Submission**: Student submits exam via `POST /api/student/submit-exam`
2. **Queue**: TIPE_3 (essay) responses are added to `correctionQueue` in `aiService.js`
3. **Background Worker**: Processes queue with 4-second delay between requests (Gemini rate limit: 15 req/min)
4. **Score Update**: AI scores stored in `student_responses.skor` with status remaining `menunggu`
5. **Human Verification**: Dosen reviews/approves AI scores via grading endpoints

### Grading Calculation Modes
Set via `exams.grading_type` enum:
- **PER_SOAL**: Direct sum of all scores (default)
- **PER_KATEGORI**: Weighted percentage calculation using `bobot_pilgan`, `bobot_esai`, `bobot_upload`

Logic handled in `services/gradingService.js:calculateFinalScore()`.

### Authentication Flow
1. Register: `POST /api/register` (creates user with `status_aktif: false`)
2. Admin approval: `PUT /api/admin/users/:id/approve` (sets `status_aktif: true`)
3. Login: `POST /api/login` (returns JWT token)
4. Protected routes use middleware chain: `verifyToken` → role check (`isAdmin`, `isDosen`, etc.)

### Security Patterns
- **Ownership checks**: Dosen endpoints verify `kode_dosen` matches `req.user.id.toString()`
- **No hardcoded secrets**: JWT_SECRET must be in environment (throws error if missing)
- **Role-based guards**: `isAdmin`, `isDosen`, `isDosenOrSuperAdmin` in `middlewares/authMiddleware.js`

## File Structure

```
controllers/     # Request handlers (auth, exam, grading, student, etc.)
routes/          # Express route definitions
services/        # Business logic (aiService, gradingService)
middlewares/     # authMiddleware, uploadMiddleware
utils/           # Helper functions
prisma/          # Database schema & migrations
uploads/         # Multer file storage
```

## Key Files

- **index.js**: Server entry point, route registration
- **services/aiService.js**: Gemini AI integration with queue management
  - `addToQueue()`: Adds essay to correction queue
  - `processQueue()`: Background worker with rate limiting
  - `gradeWithAI()`: Calls Gemini API with grading prompt
- **services/gradingService.js**: Score calculation engine for both grading modes
- **controllers/studentController.js**: Exam submission logic, triggers AI queue
- **controllers/gradingController.js**: Manual grading interface for dosen
- **prisma/schema.prisma**: Complete data model including `exam_attempts` table

## Database Key Tables

- **users**: Handles all roles (super_admin, admin, dosen, mahasiswa)
- **exams**: Stores exam config including `grading_type` and category weights
- **questions**: Stores all question types with `bobot_nilai` (individual weight)
- **student_responses**: Individual answers with `skor` and `status_penilaian`
- **exam_attempts**: Human-in-the-loop verification table with aggregated scores (`skor_pilgan_100`, `skor_esai_100`, `skor_file_100`)
- **exam_violations**: AI proctoring violations (not yet fully implemented)

## Important Behaviors

### AI Queue Processing
- Queue processes automatically when jobs are added via `addToQueue()`
- 4-second delay enforced between API calls to avoid rate limits
- Failed API calls return job to queue for retry
- Updates `student_responses.skor` AND `exam_attempts.skor_esai_100`
- Status remains `menunggu` even after AI scoring (requires dosen verification)

### Score Recalculation Triggers
Both AI auto-grading and manual grading update `exam_attempts` table:
- Weighted average calculation per category (pilgan/esai/upload)
- Uses `bobot_nilai` from questions table
- Only counts responses where `skor IS NOT NULL`

### Manual Grading Workflow
1. Dosen fetches pending answers: `GET /api/grading/exams/:exam_id/answers`
2. Dosen submits score: `PUT /api/grading/responses/:response_id/score`
3. Status changes from `menunggu` → `selesai`
4. Triggers recalculation in `exam_attempts`

## Known Limitations

- No automated test suite (`package.json` has placeholder)
- AI prompt is in Indonesian (targeted for Indonesian universities)
- Rate limiting relies on delay, not queue throttling library
- TIPE_2 multiple choice answer format must be consistent (comma-separated string or array)
