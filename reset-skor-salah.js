// Jalanin ini di server CBT production (folder cbt-api), SETELAH fix
// gradingController.js sudah di-deploy. Cari semua student_responses yang
// skor-nya lebih gede dari bobot_nilai soalnya sendiri -- itu tanda pasti
// kena bug lama (skor 0-100 mentah, gak diskalakan ke bobot soal).
//
// PENTING: ini RESET skor-nya doang (balikin ke null + status 'menunggu'),
// BUKAN hapus baris jawabannya. jawaban_teks/file_path (upload-an mahasiswa)
// tetap utuh -- dosen tinggal nilai ulang lewat halaman Penilaian yang
// sekarang udah bener (skala bobot soal, bukan 0-100).
//
// Cara jalanin:
//   node reset-skor-salah.js                  -> preview SEMUA yang kena bug
//   node reset-skor-salah.js --user=siti       -> preview, filter nama/email mengandung "siti"
//   node reset-skor-salah.js --user=siti --apply   -> BENERAN reset punya Siti aja
//   node reset-skor-salah.js --apply           -> BENERAN reset SEMUA yang kena bug

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find(a => a.startsWith('--user='));
const FILTER_USER = userArg ? userArg.split('=')[1].toLowerCase() : null;

(async () => {
    const semua = await prisma.student_responses.findMany({
        where: { skor: { not: null } },
        include: { questions: { select: { bobot_nilai: true, tipe_soal: true } }, users: { select: { nama: true, email: true } } }
    });

    let rusak = semua.filter(r => {
        const bobot = parseFloat(r.questions?.bobot_nilai || 0);
        const skor = parseFloat(r.skor || 0);
        return bobot > 0 && skor > bobot;
    });

    if (FILTER_USER) {
        rusak = rusak.filter(r =>
            r.users?.nama?.toLowerCase().includes(FILTER_USER) ||
            r.users?.email?.toLowerCase().includes(FILTER_USER)
        );
    }

    console.log(`Total jawaban ternilai: ${semua.length}`);
    console.log(`Kena bug (skor > bobot soal)${FILTER_USER ? ` & cocok filter "${FILTER_USER}"` : ''}: ${rusak.length}\n`);

    rusak.forEach(r => {
        console.log(`  id=${r.id} | ${r.users?.nama} (${r.users?.email}) | tipe=${r.questions.tipe_soal} | skor tersimpan=${r.skor} | bobot soal=${r.questions.bobot_nilai}`);
    });

    if (rusak.length === 0) {
        console.log('\nGak ada yang perlu direset.');
        process.exit(0);
    }

    if (!APPLY) {
        console.log('\n(Mode preview -- gak ada yang diubah. Jalanin ulang pakai --apply buat beneran reset.)');
        process.exit(0);
    }

    const ids = rusak.map(r => r.id);
    const hasil = await prisma.student_responses.updateMany({
        where: { id: { in: ids } },
        data: { skor: null, status_penilaian: 'menunggu' }
    });
    console.log(`\n${hasil.count} jawaban direset ke 'menunggu' -- dosen perlu nilai ulang lewat halaman Penilaian.`);
    process.exit(0);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
