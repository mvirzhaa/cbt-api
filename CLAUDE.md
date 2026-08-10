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
SIAKAD_API_BASE_URL="https://api-siak.uika-bogor.ac.id"  # Optional: unset = siakadClient runs in stub/simulation mode. Bare host, no /api suffix.
SIAKAD_ADMIN_USERNAME="adminakademik"               # Required (when SIAKAD_API_BASE_URL is set): CBT's service-account login to SIAKAD
SIAKAD_ADMIN_PASSWORD="password123"                 # Required (when SIAKAD_API_BASE_URL is set): see above
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

**AI Grading (TIPE_3)** - Background queue with automatic fallback:
1. **Submission**: Student submits exam via `POST /api/student/submit-exam`
2. **Queue**: TIPE_3 (essay) responses are added to `correctionQueue` in `aiService.js`
3. **Model Fallback**: System tries models in priority order:
   - `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-2.5-pro`
   - Automatically switches if 404/503/429 errors occur
4. **Retry Logic**: Max 3 retries per job with exponential backoff (8s, 10s, 12s)
5. **Background Worker**: Processes queue with base 8-second delay (respects Gemini rate limit: 15 req/min free tier)
6. **Score Update**: AI scores stored in `student_responses.skor` with status remaining `menunggu`
7. **Human Verification**: Dosen reviews/approves AI scores via grading endpoints
8. **Failure Handling**: After 3 failed retries, sets score to 0 and requires manual grading

**Queue Safeguards (Phase 1 Optimization):**
- Soft limit: Max 2000 jobs in queue (warning at 1000)
- TTL: Jobs expire after 1 hour (auto-skip)
- No per-question recalculation in AI worker (saves 80% DB queries)
- Batch recalculation via `POST /api/grading/exams/:exam_id/recalculate`

See `docs/AI_TROUBLESHOOTING.md` for error handling details.

### Grading Calculation Modes
`exams.grading_type` enum has two values, but **only PER_KATEGORI is actually in effect right now**:
- **PER_KATEGORI** (currently the only live mode): Weighted percentage using `bobot_pilgan`, `bobot_esai`, `bobot_upload`. `dosenController.verifyExam()` (the endpoint that publishes the official `final_score`) always uses this formula regardless of the stored `grading_type`. `gradingController.getMatakuliahScores()` (the pre-verification rekap preview) force-overrides `grading_type` to `PER_KATEGORI` when calling `gradingService.calculateFinalScore()` for the same reason — so the preview matches what verification will actually publish.
- **PER_SOAL** (reserved, not reachable): Direct sum of all raw scores. The calculation branch exists in `services/gradingService.js:calculateFinalScore()`, but `grading_type` is never exposed in `createExam`/`updateExam`, so no exam can actually be set to it, and `verifyExam` doesn't branch on it at all. This is reserved for a planned future feature (per-question weighting instead of per-category weighting) — don't wire it up as "direct sum per category" without revisiting `verifyExam` too, or the same preview/official-score mismatch bug will come back.

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
- **exam_violations**: AI proctoring violations (`jenis_pelanggaran` enum, `status` review workflow — see "AI Proctoring" below)

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

### SIAKAD Score Push (real integration — OBE/NL-SIAK "Jalur D")
The contract below was reverse-engineered from `index (2).html` (an internal
Postman-style dev tool for the SIAKAD/OBE backend, "Tes Response untuk BE —
OBE & Jalur A/C"), not guessed — payload shapes are copied from its `kirim*`
JS functions.

- **Auth is per-request login, not a shared secret.** `services/siakadClient.js`
  logs in as a CBT service account (`POST /api/auth/login` with
  `SIAKAD_ADMIN_USERNAME`/`SIAKAD_ADMIN_PASSWORD`) and caches the returned JWT
  until near expiry (decoded via `jsonwebtoken`), re-logging in on 401. There
  is no more `SIAKAD_SHARED_SECRET`.
- **Setup, once per exam** (dosen or super_admin), via `PUT
  /api/siakad/exams/:exam_id/target`: `siakad_kelas_kuliah_id` +
  `siakad_periode_akademik_id` (as before) **plus** `siakad_rencana_evaluasi_id`
  — the SIAK "Rencana Evaluasi" row (one evaluation component, e.g. UTS) that
  this exam's scores push to. To discover the right ID, call `GET
  /api/siakad/rencana-evaluasi?kode_mk=&periode_id=` first (proxies SIAK's
  `GET /koordinator-mk/mata-kuliah/:id/rencana-evaluasi`, resolving
  `:id` from `mata_kuliah.siakad_id`).
- **CPMK/Sub-CPMK mapping**: local `cpmk`/`sub_cpmk` rows are pure shadow
  mirrors of SIAK — there is no manual entry and no fuzzy reconciliation.
  `GET /api/siakad/mata-kuliah/:kode_mk/pemetaan-cpmk` (proxy of SIAK's
  `GET /obe/mata-kuliah/:id/pemetaan-cpmk`) returns the live CPMK/Sub-CPMK
  tree straight from SIAK; `POST /api/siakad/mata-kuliah/:kode_mk/resolve-cpmk`
  (`resolveCpmkFromSiakad` in `siakadController.js`) is the *only* way a local
  `cpmk`/`sub_cpmk` row gets created — it upserts by `kode`, copying
  `deskripsi`/`external_id` straight off the SIAK response the dosen picked,
  never typed by hand. `CpmkManagement.jsx` (frontend) renders that SIAK tree
  directly per mata kuliah and offers an "Impor" button per CPMK/Sub-CPMK
  instead of a create form; a mata kuliah must have `siakad_id` set before
  anything can be imported for it. `POST /api/cpmk`, `PUT /api/cpmk/:id`,
  `POST /api/cpmk/:cpmk_id/sub-cpmk`, `PUT /api/cpmk/sub-cpmk/:id`, and
  `POST /api/siakad/mata-kuliah/:kode_mk/sync-cpmk` (the old fuzzy
  kode-matching endpoint) have all been removed — `GET /api/cpmk`,
  `DELETE /api/cpmk/:id`, `DELETE /api/cpmk/sub-cpmk/:id` remain, for listing
  and unlinking a wrongly-imported row (doesn't touch SIAK, can be
  re-imported anytime). `questions.cpmk_id`/`sub_cpmk_id` can be set both when
  importing from the question bank (`questionBankController.js`) *and*
  directly on `POST/PUT /api/questions` (`cpmk_id`/`sub_cpmk_id` body fields
  — previously only the free-text `cpmk` label was settable there). `GET
  /api/questions` returns a `siakad_ready` flag per question (has a mapped
  CPMK/Sub-CPMK with a populated `external_id`) so a dosen can see
  push-readiness before publishing. Questions without a resolvable
  `cpmk_id`/`sub_cpmk_id` → `external_id` are simply skipped from the
  breakdown push (not an error) — same as the reference tool's own behavior
  when a mapping is missing.
- **Push** is only allowed for `exam_attempts.status === 'SELESAI'` (dosen
  must verify/publish in CBT first): `POST /api/siakad/attempts/:attempt_id/push`
  (single) or `POST /api/siakad/exams/:exam_id/push` (bulk, all `SELESAI`
  attempts). Each queued job does **two SIAK calls in sequence**:
  1. `POST /cbt/komponen/:rencanaEvaluasiId/nilai` — per-question breakdown
     (`skorDiperoleh`/`skorMaksimal` from `student_responses.skor`/
     `questions.bobot_nilai`, `pemetaanCpmk` from the CPMK mapping above).
     Ephemeral on SIAK's side; resending for the same student replaces, not
     duplicates.
  2. `POST /cbt/nilai-akhir` — `exam_attempts.final_score` as-is (SIAK derives
     huruf mutu itself).

  Both calls are keyed by **`krsId`** (SIAK's per-student per-class enrollment
  ID — *not* NIM). `services/siakadQueueService.js` resolves NIM → krsId at
  push time via `GET /dosen/kelas/:kelasId/nilai`, cached in-memory per class
  for 10 minutes (not persisted — enrollment can change). A job only reaches
  `TERKIRIM` if both calls succeed; a partial failure retries the whole job
  (safe, since both endpoints are replace-not-duplicate).
- `services/siakadQueueService.js` still mirrors `aiService.js`'s in-memory
  queue pattern (FIFO, TTL, retry with backoff, `getQueueStatus()`/`clearQueue()`
  exposed at `GET/POST /api/siakad/queue/status|clear`).
- Without `SIAKAD_API_BASE_URL` set, `siakadClient.js` runs in **stub/simulation
  mode** (every call — login, rencana-evaluasi lookup, peserta-kelas lookup,
  both push calls — always succeeds and logs a warning instead of hitting the
  network).
- Sync status is tracked per attempt in `exam_attempts.siakad_sync_status`
  (`BELUM_SINKRON`/`ANTRIAN`/`TERKIRIM`/`GAGAL`) + `siakad_synced_at`/
  `siakad_error`, surfaced in `RekapNilai.jsx` (frontend) as a badge with a
  per-row Push/Retry button and a bulk "Push Semua ke SIAKAD" button.
- Schema: `prisma/migration_siakad_sync.sql` (kelas/periode target + sync
  status columns) and `prisma/migration_siakad_obe_cbt_push.sql`
  (`siakad_rencana_evaluasi_id`) — neither applied to the live DB as of this
  writing, run manually once MySQL is reachable, per this project's migration
  convention.
- Still out of scope: NIM/NIDN capture at registration, KRS enrollment
  validation on exam join (krsId lookup only happens at push time, not when a
  student joins the exam).

### AI Proctoring
- Detection runs entirely client-side in `TakeExam.jsx` (cbt-frontend): face-api.js (`tiny_face_detector`) scans every 3s for face count, plus behavior listeners for tab switch (`visibilitychange`), fullscreen exit (`fullscreenchange`), copy/paste/context-menu, and a devtools-open heuristic (`outerWidth`/`innerWidth` gap). Each detection posts a screenshot + `jenis_pelanggaran` to `POST /api/proctoring/report` (rate-limited, 12/min per user; `jenis_pelanggaran` validated against the Prisma enum `exam_violations_jenis_pelanggaran`).
- **Identity verification is out of scope** — detection is presence/count/behavior-based only, it cannot confirm *which* student is on camera (would need a reference photo + face-recognition model, not just the lightweight detector currently loaded).
- **Tamper detection**: FE pings `POST /api/proctoring/heartbeat` every 10s while an exam is in progress. `services/proctoringHeartbeatService.js` (in-memory, mirrors `siakadQueueService.js`'s pattern) sweeps every 15s and auto-logs a `PENGAWAS_AI_TIDAK_AKTIF` violation (no screenshot, `foto_bukti: null`) if a student's heartbeat goes silent for >20s — catches cases where the student disabled the proctoring script via devtools. Heartbeat tracking is stopped via `stopTracking()` when the exam is submitted (`studentController.js`), so a normal submission doesn't trigger a false "AI inactive" report.
- Dosen dashboard (`AiProctoring.jsx`, frontend) polls `GET /api/proctoring` every 10s (filters: `exam_id`, `status`; paginated), and can mark a violation reviewed via `PATCH /api/proctoring/:id/review` (sets `status: DITINJAU`, `ditinjau_at`, `ditinjau_oleh`).
- **Deliberately not connected to grading** — a logged violation never affects `exam_attempts`/`final_score`. Wiring proctoring outcomes into scoring/blocking is an intentional future decision, not an oversight.
- Schema for this feature lives in `prisma/migration_proctoring_violation_enhancements.sql` (not yet applied to the live DB as of this writing — run it manually once MySQL is reachable, per this project's migration convention, same as `migration_siakad_sync.sql`).
- **Additional signals (detect-only, metadata-only — not blocking, not raw content)**, added on top of the above:
  - `TIDAK_MENGGUNAKAN_SEB`: checked once when the exam starts, via `navigator.userAgent` for the Safe Exam Browser signature. Detect-only — a non-SEB browser is logged but never blocked from starting/continuing the exam.
  - `KETIKAN_TIDAK_WAJAR`: an `onInput` listener on the exam wrapper inspects `InputEvent.inputType` for TIPE_3 essay textareas; `insertFromPaste`/`insertFromDrop`/`insertFromYank`/`insertReplacementText` catch paste-like insertions that bypass the normal `paste` event (already covered by `MENYALIN_TEMPEL`) — e.g. drag-dropped text. Deliberately does **not** record keystroke content, only the input-type metadata.
  - `MOUSE_TIDAK_AKTIF`: tracks the timestamp of the last `mousemove` and last `keydown` (window-level listeners), checked every 30s; fires only when **both** have been idle past `MOUSE_INACTIVE_THRESHOLD` (3 min) — requiring both avoids false positives from students who type long essays without touching the mouse.
  - New enum values live in `prisma/migration_proctoring_advanced_signals.sql` (same not-yet-applied convention as the other migration files here).

## Known Limitations

- No automated test suite (`package.json` has placeholder)
- AI prompt is in Indonesian (targeted for Indonesian universities)
- Rate limiting relies on delay, not queue throttling library
- TIPE_2 multiple choice answer format must be consistent (comma-separated string or array)
- Gemini free tier limited to 15 req/min (consider paid tier for high-volume exams)

## Troubleshooting

- **AI Service Issues**: See `AI_TROUBLESHOOTING.md` for common errors (404, 503, 429) and solutions
- **Multiple Choice**: See `MULTIPLE_CHOICE_GUIDE.md` for frontend integration
- **Test Cases**: See `TEST_MULTIPLE_CHOICE.md` for scoring validation
