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

// =========================================================================
// ⚙️ SETUP MIDDLEWARE GLOBAL
// =========================================================================
app.use(cors());
app.use(express.json());
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

// =========================================================================
// 🚀 START SERVER
// =========================================================================
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 CBT API Server Active`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});
