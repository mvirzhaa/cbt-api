/**
 * Contoh Seed Data untuk Soal Multiple Choice
 *
 * Jalankan script ini setelah membuat exam untuk menambahkan soal contoh
 *
 * Usage:
 * node example_questions_seed.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedExampleQuestions() {
    try {
        // PASTIKAN exam_id sudah ada di database
        const EXAM_ID = 1; // Ganti dengan ID ujian yang valid

        console.log('🌱 Mulai seeding soal contoh...\n');

        // =====================================================================
        // TIPE_1: Single Choice (Pilih 1 dari 5)
        // =====================================================================
        const question1 = await prisma.questions.create({
            data: {
                exam_id: EXAM_ID,
                tipe_soal: 'TIPE_1',
                cpmk: 'CPMK-01',
                isi_soal: 'Apa kepanjangan dari HTTP?',
                kunci_jawaban: 'C', // Hanya 1 jawaban benar
                bobot_nilai: 10.0,
                question_options: {
                    create: [
                        { label_pilihan: 'A', teks_pilihan: 'Hyperlink Text Transfer Protocol' },
                        { label_pilihan: 'B', teks_pilihan: 'High Transfer Text Protocol' },
                        { label_pilihan: 'C', teks_pilihan: 'Hypertext Transfer Protocol' },
                        { label_pilihan: 'D', teks_pilihan: 'Hypertext Transmission Protocol' },
                        { label_pilihan: 'E', teks_pilihan: 'High Text Transfer Protocol' }
                    ]
                }
            }
        });
        console.log('✅ TIPE_1 (Single Choice) created:', question1.id);

        // =====================================================================
        // TIPE_2: Multiple Choice (Pilih lebih dari 1)
        // =====================================================================
        const question2 = await prisma.questions.create({
            data: {
                exam_id: EXAM_ID,
                tipe_soal: 'TIPE_2',
                cpmk: 'CPMK-02',
                isi_soal: 'Manakah yang merupakan bahasa pemrograman backend? (Pilih semua yang benar)',
                kunci_jawaban: 'A,C,D', // Multiple answers (3 jawaban benar)
                bobot_nilai: 15.0,
                question_options: {
                    create: [
                        { label_pilihan: 'A', teks_pilihan: 'Node.js' },
                        { label_pilihan: 'B', teks_pilihan: 'React' },
                        { label_pilihan: 'C', teks_pilihan: 'Python (Django/Flask)' },
                        { label_pilihan: 'D', teks_pilihan: 'PHP' },
                        { label_pilihan: 'E', teks_pilihan: 'Vue.js' }
                    ]
                }
            }
        });
        console.log('✅ TIPE_2 (Multiple Choice) created:', question2.id);

        // =====================================================================
        // TIPE_2: Multiple Choice dengan 2 jawaban benar
        // =====================================================================
        const question3 = await prisma.questions.create({
            data: {
                exam_id: EXAM_ID,
                tipe_soal: 'TIPE_2',
                cpmk: 'CPMK-03',
                isi_soal: 'Manakah yang merupakan database relasional? (Pilih semua yang benar)',
                kunci_jawaban: 'B,D', // 2 jawaban benar
                bobot_nilai: 10.0,
                question_options: {
                    create: [
                        { label_pilihan: 'A', teks_pilihan: 'MongoDB' },
                        { label_pilihan: 'B', teks_pilihan: 'MySQL' },
                        { label_pilihan: 'C', teks_pilihan: 'Redis' },
                        { label_pilihan: 'D', teks_pilihan: 'PostgreSQL' },
                        { label_pilihan: 'E', teks_pilihan: 'Cassandra' }
                    ]
                }
            }
        });
        console.log('✅ TIPE_2 (Multiple Choice - 2 answers) created:', question3.id);

        // =====================================================================
        // TIPE_3: Esai (AI Grading)
        // =====================================================================
        const question4 = await prisma.questions.create({
            data: {
                exam_id: EXAM_ID,
                tipe_soal: 'TIPE_3',
                cpmk: 'CPMK-04',
                isi_soal: 'Jelaskan perbedaan antara REST API dan GraphQL!',
                kunci_jawaban: 'REST API menggunakan multiple endpoints untuk berbagai resource, sedangkan GraphQL menggunakan single endpoint. GraphQL memungkinkan client menentukan data yang dibutuhkan, REST mengirim semua data sesuai struktur server.',
                bobot_nilai: 20.0
            }
        });
        console.log('✅ TIPE_3 (Essay/AI Grading) created:', question4.id);

        // =====================================================================
        // TIPE_4: File Upload (Manual Grading)
        // =====================================================================
        const question5 = await prisma.questions.create({
            data: {
                exam_id: EXAM_ID,
                tipe_soal: 'TIPE_4',
                cpmk: 'CPMK-05',
                isi_soal: 'Upload file program kalkulator sederhana yang Anda buat (format .zip, .rar, atau .docx)',
                kunci_jawaban: null, // File upload tidak perlu kunci jawaban
                bobot_nilai: 25.0
            }
        });
        console.log('✅ TIPE_4 (File Upload) created:', question5.id);

        console.log('\n🎉 Seeding selesai! Total soal ditambahkan: 5');
        console.log('\nRingkasan:');
        console.log('- TIPE_1 (Single Choice)   : 1 soal (10 poin)');
        console.log('- TIPE_2 (Multiple Choice) : 2 soal (25 poin)');
        console.log('- TIPE_3 (Essay/AI)        : 1 soal (20 poin)');
        console.log('- TIPE_4 (File Upload)     : 1 soal (25 poin)');
        console.log('Total bobot: 80 poin\n');

    } catch (error) {
        console.error('❌ Error saat seeding:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Jalankan seeding
seedExampleQuestions()
    .then(() => {
        console.log('✅ Database connection closed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
