require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const matakuliahRoutes = require('./routes/matakuliah');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const studentRoutes = require('./routes/student');
const gradingRoutes = require('./routes/grading');
const materiRoutes = require('./routes/materi');
const proctoringRoutes = require('./routes/proctoring');
const dosenRoutes = require('./routes/dosen');
const siakadRoutes = require('./routes/siakad');
const cpmkRoutes = require('./routes/cpmk');
const questionBankRoutes = require('./routes/questionBank');

// =========================================================================
// ⚙️ SETUP MIDDLEWARE GLOBAL
// =========================================================================
app.use(cors());
app.use((req, res, next) => {
    express.json()(req, res, (err) => {
        if (err) {
            // JSON Parse Error dari body-parser
            console.error(`[JSON Parse Error] ${req.method} ${req.url}`);
            console.error(`  Raw Content-Type: ${req.headers['content-type']}`);
            console.error(`  Error: ${err.message}`);
            return res.status(400).json({
                message: "Request body bukan JSON yang valid. Pastikan Content-Type: application/json dan body JSON tidak rusak.",
                detail: err.message
            });
        }
        next();
    });
});
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.json({ message: "CBT API Ready! 🚀 AI Auto-Grader & Tenant Isolation Activated." });
});

// =========================================================================
// 🔌 REGISTER ROUTES
// =========================================================================
app.use('/api', authRoutes);
app.use('/api/admin/users', adminRoutes);
app.use('/api/matakuliah', matakuliahRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/materi', materiRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/dosen', dosenRoutes);
app.use('/api/siakad', siakadRoutes);
app.use('/api/cpmk', cpmkRoutes);
app.use('/api/question-bank', questionBankRoutes);

// =========================================================================
// 🛡️ GLOBAL ERROR HANDLER
// =========================================================================
app.use((err, req, res, next) => {
    console.error(`[Global Error] ${req.method} ${req.url} → ${err.status || 500}: ${err.message}`);
    res.status(err.status || 500).json({
        message: err.message || "Internal server error",
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// =========================================================================
// 🚀 START SERVER
// =========================================================================
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 CBT API Server Active`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});
