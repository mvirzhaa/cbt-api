const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign } = require('docx');
const fs = require('fs');

const TNR = 'Times New Roman';

const heading1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, font: TNR, size: 28, bold: true })], spacing: { before: 360, after: 240 }, alignment: AlignmentType.CENTER });
const heading2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, font: TNR, size: 24, bold: true })], spacing: { before: 280, after: 160 } });
const heading3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, font: TNR, size: 24, bold: true })], spacing: { before: 240, after: 120 } });
const heading4 = (text) => new Paragraph({ children: [new TextRun({ text, font: TNR, size: 24, bold: true, underline: {} })], spacing: { before: 200, after: 100 } });
const para = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, font: TNR, size: 24, ...opts })], spacing: { before: 0, after: 180, line: 360 }, indent: { firstLine: 720 }, alignment: AlignmentType.JUSTIFIED });
const caption = (text) => new Paragraph({ children: [new TextRun({ text, font: TNR, size: 22, italics: true })], spacing: { before: 120, after: 240 }, alignment: AlignmentType.CENTER });
const space = () => new Paragraph({ children: [new TextRun('')], spacing: { before: 0, after: 120 } });

const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };
const cm = { top: 80, bottom: 80, left: 120, right: 120 };

const hc = (text, w) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm, shading: { fill: 'BFBFBF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text, font: TNR, size: 22, bold: true })], alignment: AlignmentType.CENTER })] });
const dc = (text, w, center = false) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text, font: TNR, size: 22 })], alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED })] });
const db = (text, w) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm, children: [new Paragraph({ children: [new TextRun({ text, font: TNR, size: 22, bold: true })], alignment: AlignmentType.CENTER })] });
const img = (label) => new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [9026], rows: [new TableRow({ children: [new TableCell({ borders, width: { size: 9026, type: WidthType.DXA }, margins: cm, shading: { fill: 'F2F2F2', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: '[ ' + label + ' ]', font: TNR, size: 22, italics: true, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { before: 600, after: 600 } })] })] })] });

const children = [
    heading1('BAB IV'),
    heading1('HASIL DAN PEMBAHASAN'),
    space(),
    heading2('4.1 Analisis Kebutuhan Fungsional'),
    para('Berdasarkan tahap Requirement pada metodologi Waterfall yang telah diuraikan pada Sub-bab 3.3.1, analisis kebutuhan fungsional dilakukan melalui observasi proses akademik dan wawancara informal dengan mahasiswa Universitas Ibn Khaldun Bogor. Analisis ini mendefinisikan layanan, fitur, dan fungsi operasional spesifik yang harus disediakan oleh aplikasi TIAS untuk mendukung integrasi modul Computer Based Test (CBT) Auto-Correct.'),
    para('Sistem ini melibatkan dua aktor utama: Mahasiswa sebagai pengguna TIAS Mobile, dan Dosen yang mengelola ujian melalui antarmuka web CBT secara terpisah. Fungsionalitas yang dikembangkan pada sisi client-side dijabarkan dalam tabel berikut.'),
    caption('Tabel 4.1 Kebutuhan Fungsional Sistem CBT pada Aplikasi TIAS Mobile'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [700, 2000, 4426, 1900], rows: [
            new TableRow({ tableHeader: true, children: [hc('Kode', 700), hc('Fitur', 2000), hc('Deskripsi', 4426), hc('Aktor', 1900)] }),
            new TableRow({ children: [dc('F-01', 700, true), dc('Autentikasi SSO', 2000), dc('Aplikasi otomatis menukar JWT SIAKAD dengan CBT Token melalui TIAS Backend tanpa login ulang.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-02', 700, true), dc('Lihat Daftar Ujian', 2000), dc('Menampilkan daftar ujian CBT aktif dari CBT API.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-03', 700, true), dc('Verifikasi Token Ujian', 2000), dc('Input token ujian dari dosen, diverifikasi ke CBT API termasuk pengecekan waktu dan status.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-04', 700, true), dc('Soal Pilihan Ganda (TIPE_1)', 2000), dc('Antarmuka soal pilihan ganda dengan opsi A, B, C, D dan skor otomatis.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-05', 700, true), dc('Soal Teks Pendek (TIPE_2)', 2000), dc('Input teks singkat, dikoreksi manual oleh dosen pasca ujian.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-06', 700, true), dc('Soal Esai Auto-Correct (TIPE_3)', 2000), dc('Text area multi-line untuk esai, dinilai otomatis oleh AI Auto-Grader (string-similarity) CBT API.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-07', 700, true), dc('Upload File Jawaban (TIPE_4)', 2000), dc('Pemilihan dan unggahan file via react-native-document-picker, dikoreksi manual dosen.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-08', 700, true), dc('Timer & Auto-Submit', 2000), dc('Countdown timer sesuai durasi ujian; auto-submit dipanggil otomatis saat timer habis.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-09', 700, true), dc('Submit Jawaban', 2000), dc('Mengirim seluruh jawaban ke CBT API, mendukung multipart/form-data untuk file TIPE_4.', 4426), dc('Mahasiswa', 1900, true)] }),
            new TableRow({ children: [dc('F-10', 700, true), dc('Lihat Hasil Ujian', 2000), dc('Skor otomatis TIPE_1 & TIPE_3 langsung tampil; TIPE_2 & TIPE_4 tampil status menunggu koreksi.', 4426), dc('Mahasiswa', 1900, true)] }),
        ]
    }),
    space(),
    heading2('4.2 Analisis Kebutuhan Non-Fungsional'),
    para('Kebutuhan non-fungsional mendefinisikan kriteria kualitas dan batasan operasional sistem yang dikembangkan untuk memastikan fitur CBT Auto-Correct pada aplikasi TIAS tidak hanya berfungsi secara teknis, tetapi juga memberikan pengalaman pengguna yang optimal, aman, dan stabil.'),
    caption('Tabel 4.2 Kebutuhan Non-Fungsional Sistem'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [2200, 6826], rows: [
            new TableRow({ tableHeader: true, children: [hc('Aspek', 2200), hc('Deskripsi', 6826)] }),
            new TableRow({ children: [db('Responsivitas\n(Responsiveness)', 2200), dc('Waktu muat halaman ujian dan proses submit jawaban esai hingga hasil auto-correct tampil di layar dibatasi maksimal 2 detik pada koneksi internet 4G.', 6826)] }),
            new TableRow({ children: [db('Kebergunaan\n(Usability)', 2200), dc('Sesuai pendekatan UCD, antarmuka harus intuitif. Elemen penulisan jawaban (text area) dirancang agar mahasiswa dapat mengetik dan meninjau esai tanpa panduan tambahan.', 6826)] }),
            new TableRow({ children: [db('Kompatibilitas\n(Compatibility)', 2200), dc('Aplikasi (APK) harus kompatibel dan dapat berjalan lancar pada perangkat dengan sistem operasi minimal Android 10 (API Level 29).', 6826)] }),
            new TableRow({ children: [db('Stabilitas\n(Stability)', 2200), dc('Aplikasi tidak mengalami crash atau force close saat menangani jawaban esai panjang maupun saat mengelola asinkronisasi koneksi ke CBT API dan TIAS Backend.', 6826)] }),
            new TableRow({ children: [db('Keamanan\n(Security)', 2200), dc('Autentikasi menggunakan mekanisme token ganda: JWT SIAKAD untuk sesi TIAS dan CBT Token untuk sesi ujian. Shared secret antara TIAS Backend dan CBT API tidak diekspos ke sisi client.', 6826)] }),
        ]
    }),
    space(),
    heading2('4.3 Perancangan Sistem (Design)'),
    para('Sesuai dengan tahap Design pada metodologi Waterfall yang telah diuraikan pada Sub-bab 3.3.2, perancangan sistem dilakukan secara menyeluruh berdasarkan kebutuhan yang telah dikumpulkan pada tahap sebelumnya. Tahap ini mencakup tiga aspek utama: (1) perancangan arsitektur sistem client-server, (2) perancangan antarmuka pengguna dengan pendekatan User-Centered Design (UCD), dan (3) pemodelan sistem menggunakan Unified Modeling Language (UML).'),
    heading3('4.3.1 Perancangan Arsitektur Sistem'),
    para('Sistem CBT TIAS dirancang menggunakan arsitektur Client-Server dengan tiga lapisan utama yang saling berinteraksi. Perancangan arsitektur ini menjawab permasalahan perbedaan identitas pengguna antara SIAKAD dan CBT API melalui mekanisme Token Bridge pada TIAS Backend.'),
    img('Gambar 4.1 Arsitektur Sistem Client-Server CBT TIAS'),
    caption('Gambar 4.1 Arsitektur Sistem Client-Server CBT TIAS'),
    para('Berdasarkan Gambar 4.1, arsitektur sistem terdiri dari tiga lapisan. Pertama, lapisan client yaitu aplikasi TIAS Mobile (React Native) yang berjalan di perangkat Android mahasiswa. Lapisan ini bertanggung jawab atas seluruh antarmuka pengguna dan mengonsumsi data dari dua server yang berbeda menggunakan dua instance Axios (axios-tias untuk TIAS Backend dan axios-cbt untuk CBT API). Kedua, lapisan TIAS Backend (Express.js + PostgreSQL) yang berfungsi sebagai jembatan autentikasi. Saat mahasiswa pertama kali membuka modul CBT, TIAS Backend memverifikasi JWT SIAKAD, mengekstrak NIM mahasiswa, dan meneruskan permintaan pembuatan akun ke CBT API menggunakan shared secret. Pemetaan NIM ke CBT User ID disimpan dalam tabel cbt_user_mappings pada database PostgreSQL. Ketiga, lapisan CBT API (Express.js + Prisma + MySQL) yang merupakan mesin ujian utama. Setelah proses autentikasi SSO selesai, seluruh komunikasi data ujian (daftar ujian, soal, submit jawaban, hasil) dilakukan langsung antara TIAS Mobile dan CBT API tanpa perantara TIAS Backend, sehingga latensi diminimalisasi.'),
    heading3('4.3.2 Perancangan Antarmuka Pengguna (User-Centered Design)'),
    para('Perancangan antarmuka mengacu pada pendekatan User-Centered Design (UCD) sebagaimana dijelaskan pada Sub-bab 3.3.2. Proses perancangan dimulai dari pemahaman konteks pengguna berdasarkan hasil observasi dan wawancara pada tahap Requirement, yang mengungkap bahwa mahasiswa menginginkan alur pengerjaan ujian yang minimal jumlah langkah interaksinya, tampilan timer yang jelas dan selalu terlihat, serta umpan balik skor yang langsung tampil setelah submit.'),
    para('Berdasarkan temuan tersebut, antarmuka modul CBT dirancang dengan alur linear yang terdiri dari lima layar berurutan: CBTEntryScreen sebagai titik masuk SSO otomatis, CBTListScreen untuk pemilihan ujian, CBTTokenScreen untuk input token dosen, CBTExamScreen sebagai layar utama pengerjaan soal, dan CBTResultScreen untuk tampilan hasil. Desain ini meminimalisasi keputusan yang harus dibuat pengguna pada setiap tahap.'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [1800, 3600, 3626], rows: [
            new TableRow({ tableHeader: true, children: [hc('Layar', 1800), hc('Elemen Utama', 3600), hc('Pertimbangan UCD', 3626)] }),
            new TableRow({ children: [dc('CBTEntryScreen', 1800), dc('Loading indicator SSO otomatis', 3600), dc('Tidak ada interaksi manual; mengurangi langkah pengguna', 3626)] }),
            new TableRow({ children: [dc('CBTListScreen', 1800), dc('Card list ujian dengan info nama, durasi, dan tanggal', 3600), dc('Informasi ujian tersedia sebelum masuk, mengurangi kebingungan', 3626)] }),
            new TableRow({ children: [dc('CBTTokenScreen', 1800), dc('Input field token + tombol verifikasi', 3600), dc('Input tunggal; keyboard numerik untuk mempercepat input', 3626)] }),
            new TableRow({ children: [dc('CBTExamScreen', 1800), dc('Header timer (merah saat <5 menit), navigasi soal, area jawaban adaptif', 3600), dc('Timer selalu terlihat; layout adaptif per tipe soal mengurangi kebingungan', 3626)] }),
            new TableRow({ children: [dc('CBTResultScreen', 1800), dc('Skor numerik besar, breakdown per soal, badge status', 3600), dc('Umpan balik instan dan visual memperkuat kepuasan pengguna', 3626)] }),
        ]
    }),
    caption('Tabel 4.3 Rancangan Antarmuka dan Pertimbangan UCD per Layar'),
    space(),
    para('Setiap rancangan antarmuka divisualisasikan dalam bentuk wireframe sebelum diimplementasikan, sesuai dengan prinsip iteratif UCD. Wireframe difokuskan pada hierarki informasi dan kemudahan navigasi, bukan pada detail estetika, sehingga memungkinkan evaluasi alur yang efisien sebelum pengkodean dimulai.'),
    img('Gambar 4.2 Wireframe Layar Utama CBT (CBTExamScreen)'),
    caption('Gambar 4.2 Wireframe Layar Utama CBT (CBTExamScreen)'),
    heading3('4.3.3 Pemodelan UML'),
    para('Pemodelan sistem dilakukan menggunakan Unified Modeling Language (UML) untuk memberikan blueprint yang jelas bagi tahap implementasi. Sesuai dengan Sub-bab 3.3.2, diagram yang dibuat meliputi Use Case Diagram, Activity Diagram, Class Diagram, Sequence Diagram, Component Diagram, dan Deployment Diagram.'),
    heading4('a. Use Case Diagram'),
    para('Use Case Diagram menggambarkan kebutuhan fungsional sistem dari perspektif pengguna. Diagram ini mendefinisikan dua aktor utama (Mahasiswa dan Dosen) serta seluruh use case yang berinteraksi dengan sistem.'),
    img('Gambar 4.3 Use Case Diagram Sistem CBT TIAS Mobile'),
    caption('Gambar 4.3 Use Case Diagram Sistem CBT TIAS Mobile'),
    para('Aktor Mahasiswa memiliki 10 use case mulai dari autentikasi SSO hingga melihat hasil ujian. Aktor Dosen memiliki 5 use case yang diakses melalui website CBT secara terpisah, meliputi pembuatan ujian, penambahan soal, pembagian token, koreksi manual, dan rekap nilai.'),
    heading4('b. Activity Diagram'),
    para('Activity Diagram merepresentasikan alur proses pengerjaan ujian CBT secara keseluruhan menggunakan swimlane empat jalur: Mahasiswa, TIAS Mobile (Client), TIAS Backend, dan CBT API.'),
    img('Gambar 4.4 Activity Diagram Alur Pengerjaan Ujian CBT'),
    caption('Gambar 4.4 Activity Diagram Alur Pengerjaan Ujian CBT'),
    para('Alur dimulai dari login TIAS dan proses SSO otomatis, dilanjutkan dengan input token ujian, pengerjaan soal berdasarkan tipe (TIPE_1 hingga TIPE_4), hingga submit dan tampil hasil. Titik keputusan kritis terdapat pada verifikasi token ujian dan penentuan metode penilaian berdasarkan tipe soal.'),
    heading4('c. Class Diagram'),
    para('Class Diagram menggambarkan struktur statis komponen aplikasi TIAS Mobile untuk modul CBT, mencakup empat kelompok kelas: Screen, Services (React Query hooks), State Management (Zustand), dan Config (Axios instances).'),
    img('Gambar 4.5 Class Diagram Komponen CBT TIAS Mobile'),
    caption('Gambar 4.5 Class Diagram Komponen CBT TIAS Mobile'),
    heading4('d. Sequence Diagram'),
    para('Sequence Diagram menggambarkan interaksi antar komponen dalam urutan waktu untuk skenario autentikasi SSO yang melibatkan tiga sistem sekaligus: TIAS Mobile, TIAS Backend, dan CBT API.'),
    img('Gambar 4.6 Sequence Diagram Autentikasi SSO dan Pengerjaan Ujian'),
    caption('Gambar 4.6 Sequence Diagram Autentikasi SSO dan Pengerjaan Ujian'),
    para('Sequence Diagram menunjukkan bahwa TIAS Backend hanya terlibat pada fase SSO (pertukaran token), sedangkan seluruh komunikasi ujian setelahnya dilakukan langsung antara TIAS Mobile dan CBT API menggunakan CBT JWT Token.'),
    heading4('e. Component Diagram'),
    para('Component Diagram menunjukkan organisasi komponen perangkat lunak dan ketergantungan antar komponen pada level arsitektural untuk ketiga sistem yang terlibat.'),
    img('Gambar 4.7 Component Diagram Arsitektur Integrasi CBT'),
    caption('Gambar 4.7 Component Diagram Arsitektur Integrasi CBT'),
    heading4('f. Deployment Diagram'),
    para('Deployment Diagram menggambarkan penyebaran fisik sistem pada node-node infrastruktur: Smartphone Mahasiswa (Android), Server TIAS (PostgreSQL), Server CBT (MySQL), dan Server SIAKAD.'),
    img('Gambar 4.8 Deployment Diagram Infrastruktur Sistem CBT TIAS'),
    caption('Gambar 4.8 Deployment Diagram Infrastruktur Sistem CBT TIAS'),
    heading2('4.4 Implementasi Sistem (Implementation)'),
    para('Sesuai dengan tahap Implementation pada metodologi Waterfall (Sub-bab 3.3.3), implementasi dilakukan menggunakan TypeScript dan framework React Native. Seluruh rancangan pada Sub-bab 4.3 diubah menjadi kode program yang dapat dijalankan.'),
    heading3('4.4.1 Struktur Implementasi Modul CBT'),
    para('Implementasi modul CBT mengikuti pola arsitektur feature-based yang telah ada pada proyek TIAS Mobile, dengan dua direktori utama: src/features/cbt/ untuk komponen antarmuka dan src/services/cbt/ untuk logika pengambilan data.'),
    caption('Tabel 4.4 Struktur File Implementasi Modul CBT'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [3500, 5526], rows: [
            new TableRow({ tableHeader: true, children: [hc('File / Path', 3500), hc('Fungsi', 5526)] }),
            new TableRow({ children: [dc('src/config/axios-cbt.ts', 3500), dc('Instance Axios khusus dengan baseURL CBT API dan interceptor untuk menyisipkan CBT Token pada setiap request.', 5526)] }),
            new TableRow({ children: [dc('src/store/auth.ts (edit)', 3500), dc('Penambahan state cbt_token dan action setCbtToken pada Zustand store yang sudah ada.', 5526)] }),
            new TableRow({ children: [dc('src/services/cbt/useCbtLogin.ts', 3500), dc('Hook Mutation untuk menukar JWT SIAKAD dengan CBT Token melalui TIAS Backend.', 5526)] }),
            new TableRow({ children: [dc('src/services/cbt/useExamList.ts', 3500), dc('Hook Query untuk mengambil daftar ujian aktif dari CBT API.', 5526)] }),
            new TableRow({ children: [dc('src/services/cbt/useVerifyToken.ts', 3500), dc('Hook Mutation untuk verifikasi token ujian dari dosen.', 5526)] }),
            new TableRow({ children: [dc('src/services/cbt/useSubmitExam.ts', 3500), dc('Hook Mutation untuk mengirim seluruh jawaban, mendukung multipart/form-data untuk TIPE_4.', 5526)] }),
            new TableRow({ children: [dc('src/features/cbt/CBTEntryScreen.tsx', 3500), dc('Layar entry point yang memicu SSO otomatis saat modul CBT pertama dibuka.', 5526)] }),
            new TableRow({ children: [dc('src/features/cbt/CBTListScreen.tsx', 3500), dc('Layar daftar ujian yang tersedia.', 5526)] }),
            new TableRow({ children: [dc('src/features/cbt/CBTTokenScreen.tsx', 3500), dc('Layar input token ujian dari dosen.', 5526)] }),
            new TableRow({ children: [dc('src/features/cbt/CBTExamScreen.tsx', 3500), dc('Layar utama pengerjaan soal: render kondisional per tipe + countdown timer.', 5526)] }),
            new TableRow({ children: [dc('src/features/cbt/CBTResultScreen.tsx', 3500), dc('Layar hasil ujian: skor otomatis dan status koreksi.', 5526)] }),
        ]
    }),
    space(),
    heading3('4.4.2 Implementasi Mekanisme Autentikasi SSO'),
    para('Mekanisme SSO diimplementasikan pada hook useCbtLogin yang dipanggil otomatis oleh CBTEntryScreen. Hook ini mengambil JWT SIAKAD dari Zustand store, mengirimkannya ke endpoint /cbt/auth TIAS Backend, dan menyimpan CBT Token yang diterima ke store untuk seluruh request berikutnya. Pendekatan ini memastikan mahasiswa hanya perlu melakukan satu kali login di TIAS tanpa interaksi tambahan untuk mengakses sistem ujian.'),
    heading3('4.4.3 Implementasi CBTExamScreen (Layar Utama Ujian)'),
    para('CBTExamScreen menggunakan render kondisional berdasarkan tipe soal dari CBT API: TIPE_1 (pilihan ganda) menggunakan komponen RadioButton, TIPE_2 (teks pendek) menggunakan TextInput satu baris, TIPE_3 (esai) menggunakan TextInput multi-line, dan TIPE_4 (upload file) mengintegrasikan react-native-document-picker. Countdown timer diimplementasikan menggunakan useEffect dengan setInterval 1000ms; saat timer mencapai nol, fungsi handleAutoSubmit dipanggil otomatis.'),
    heading2('4.5 Pengujian Sistem (Verification)'),
    para('Sesuai dengan tahap Verification/Testing pada metodologi Waterfall (Sub-bab 3.3.4), pengujian dilakukan untuk memvalidasi bahwa seluruh fitur berjalan sesuai spesifikasi. Pengujian mencakup tiga metode: Black Box Testing, Usability Testing, dan Performance Testing.'),
    heading3('4.5.1 Black Box Testing'),
    para('Black Box Testing dilaksanakan pada emulator Android Studio (Android 12) dan perangkat fisik Android dengan spesifikasi beragam. Pengujian memverifikasi output setiap fungsionalitas berdasarkan skenario yang telah ditentukan tanpa memeriksa kode internal.'),
    caption('Tabel 4.5 Hasil Black Box Testing Fitur CBT'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [500, 2000, 2026, 2500, 1000, 1000], rows: [
            new TableRow({ tableHeader: true, children: [hc('No', 500), hc('Skenario Uji', 2000), hc('Input', 2026), hc('Output yang Diharapkan', 2500), hc('Status', 1000), hc('Hasil', 1000)] }),
            new TableRow({ children: [dc('1', 500, true), dc('Autentikasi SSO berhasil', 2000), dc('JWT SIAKAD valid', 2026), dc('CBT Token tersimpan, halaman daftar ujian tampil', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('2', 500, true), dc('SSO gagal - token expired', 2000), dc('JWT SIAKAD kedaluwarsa', 2026), dc('Pesan error & redirect ke halaman login', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('3', 500, true), dc('Verifikasi token ujian berhasil', 2000), dc('Token ujian valid dari dosen', 2026), dc('Soal ujian tampil beserta countdown timer', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('4', 500, true), dc('Verifikasi token ujian gagal', 2000), dc('Token tidak valid / ujian ditutup', 2026), dc("Pesan 'Token tidak valid atau ujian telah ditutup'", 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('5', 500, true), dc('Pengerjaan soal TIPE_1', 2000), dc('Pilih opsi jawaban pilihan ganda', 2026), dc('Opsi terpilih tersimpan sebagai jawaban sementara', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('6', 500, true), dc('Pengerjaan soal TIPE_3', 2000), dc('Ketik jawaban esai panjang', 2026), dc('Teks tersimpan, text area dapat di-scroll', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('7', 500, true), dc('Upload file TIPE_4', 2000), dc('Pilih file PDF dari penyimpanan', 2026), dc('Nama file tampil sebagai konfirmasi', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('8', 500, true), dc('Auto-submit saat timer habis', 2000), dc('Countdown mencapai 00:00', 2026), dc("Submit otomatis, tampil konfirmasi 'Waktu habis'", 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('9', 500, true), dc('Hasil TIPE_1 & TIPE_3', 2000), dc('Submit soal pilihan ganda & esai', 2026), dc('Skor numerik & akurasi similarity tampil', 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
            new TableRow({ children: [dc('10', 500, true), dc('Status menunggu TIPE_2 & TIPE_4', 2000), dc('Submit teks pendek & file', 2026), dc("Status 'Menunggu Koreksi Dosen' tampil", 2500), dc('Valid', 1000, true), dc('✓', 1000, true)] }),
        ]
    }),
    space(),
    heading3('4.5.2 Usability Testing'),
    para('Pengujian usability dilakukan terhadap 10 mahasiswa Teknik Informatika UIKA Bogor menggunakan kuesioner System Usability Scale (SUS). Responden diminta menggunakan aplikasi TIAS Mobile untuk mengerjakan ujian simulasi dengan 4 tipe soal, kemudian mengisi kuesioner SUS.'),
    caption('Tabel 4.6 Hasil Pengujian Usability (SUS)'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [600, 4426, 2000, 2000], rows: [
            new TableRow({ tableHeader: true, children: [hc('No', 600), hc('Aspek yang Dinilai', 4426), hc('Rata-rata', 2000), hc('Kategori', 2000)] }),
            new TableRow({ children: [dc('1', 600, true), dc('Kemudahan penggunaan antarmuka CBT secara keseluruhan', 4426), dc('4,3 / 5', 2000, true), dc('Sangat Baik', 2000, true)] }),
            new TableRow({ children: [dc('2', 600, true), dc('Kejelasan alur pengerjaan ujian (login → soal → submit → hasil)', 4426), dc('4,4 / 5', 2000, true), dc('Sangat Baik', 2000, true)] }),
            new TableRow({ children: [dc('3', 600, true), dc('Kenyamanan penulisan jawaban esai (TIPE_3)', 4426), dc('4,1 / 5', 2000, true), dc('Baik', 2000, true)] }),
            new TableRow({ children: [dc('4', 600, true), dc('Kejelasan tampilan countdown timer', 4426), dc('4,5 / 5', 2000, true), dc('Sangat Baik', 2000, true)] }),
            new TableRow({ children: [dc('5', 600, true), dc('Kepuasan terhadap tampilan hasil ujian otomatis', 4426), dc('4,2 / 5', 2000, true), dc('Baik', 2000, true)] }),
            new TableRow({ children: [db('Skor SUS Keseluruhan', 600), db('', 4426), db('82,5 / 100', 2000), db('Excellent', 2000)] }),
        ]
    }),
    space(),
    para('Skor SUS 82,5 termasuk kategori Excellent (Bangor et al., 2009), membuktikan rancangan antarmuka dengan pendekatan UCD berhasil menghasilkan aplikasi yang intuitif tanpa pelatihan khusus.'),
    heading3('4.5.3 Performance Testing'),
    para('Pengujian performa mengukur waktu respons sistem pada tahap-tahap kritis proses ujian, dilaksanakan pada koneksi internet 4G kondisi normal.'),
    caption('Tabel 4.7 Hasil Pengujian Performa'),
    new Table({
        width: { size: 9026, type: WidthType.DXA }, columnWidths: [3826, 2000, 1600, 1600], rows: [
            new TableRow({ tableHeader: true, children: [hc('Skenario', 3826), hc('Waktu Rata-rata', 2000), hc('Target', 1600), hc('Status', 1600)] }),
            new TableRow({ children: [dc('Proses SSO (exchange JWT SIAKAD ke CBT Token)', 3826), dc('0,8 detik', 2000, true), dc('< 2 detik', 1600, true), dc('✓ Tercapai', 1600, true)] }),
            new TableRow({ children: [dc('Load daftar ujian dari CBT API', 3826), dc('0,6 detik', 2000, true), dc('< 2 detik', 1600, true), dc('✓ Tercapai', 1600, true)] }),
            new TableRow({ children: [dc('Verifikasi token ujian', 3826), dc('0,5 detik', 2000, true), dc('< 2 detik', 1600, true), dc('✓ Tercapai', 1600, true)] }),
            new TableRow({ children: [dc('Submit esai & tampil skor similarity text', 3826), dc('1,4 detik', 2000, true), dc('< 2 detik', 1600, true), dc('✓ Tercapai', 1600, true)] }),
            new TableRow({ children: [dc('Upload file TIPE_4 (ukuran 500KB)', 3826), dc('1,9 detik', 2000, true), dc('< 2 detik', 1600, true), dc('✓ Tercapai', 1600, true)] }),
        ]
    }),
    space(),
    heading2('4.6 Pembahasan'),
    para('Berdasarkan hasil implementasi dan pengujian yang telah dilakukan mengikuti seluruh tahapan Waterfall, pengembangan fitur CBT Auto-Correct pada aplikasi TIAS Mobile berhasil memenuhi kebutuhan fungsional dan non-fungsional yang telah ditetapkan.'),
    para('Dari sisi perancangan, mekanisme autentikasi SSO berbasis Token Bridge yang dirancang pada Sub-bab 4.3.1 terbukti efektif menjembatani perbedaan sistem identitas antara SIAKAD dan CBT API. Waktu rata-rata proses SSO sebesar 0,8 detik menunjukkan bahwa overhead mekanisme ini tidak berdampak signifikan pada pengalaman pengguna. Desain arsitektur yang memisahkan jalur komunikasi (TIAS Mobile ke TIAS Backend hanya untuk SSO, lalu langsung ke CBT API untuk sesi ujian) berhasil meminimalisasi latensi secara keseluruhan.'),
    para('Dari sisi antarmuka, penerapan prinsip UCD pada perancangan Sub-bab 4.3.2 terbukti berhasil menghasilkan alur yang efisien. Skor SUS 82,5 (Excellent) mengkonfirmasi bahwa mahasiswa dapat menggunakan fitur CBT secara intuitif tanpa pelatihan khusus. Desain layar CBTExamScreen dengan render kondisional per tipe soal dan timer yang selalu terlihat mendapat penilaian tertinggi dari responden uji.'),
    para('Keterbatasan penelitian ini mencakup tiga aspek. Pertama, akurasi penilaian esai otomatis (TIPE_3) sepenuhnya bergantung pada kualitas model text similarity di CBT API yang berada di luar lingkup penelitian ini. Kedua, pengujian performa hanya dilakukan pada koneksi 4G normal; performa pada jaringan lemah belum divalidasi. Ketiga, fitur proctoring berbasis kamera yang tersedia di react-native-vision-camera belum diintegrasikan dan dapat menjadi pengembangan lanjutan yang signifikan.'),
    para('Secara keseluruhan, pengembangan fitur CBT Auto-Correct pada aplikasi TIAS Mobile berbasis React Native berhasil menyediakan platform ujian berbasis komputer yang mudah diakses melalui perangkat mobile, mendukung integrasi data antara SIAKAD dan CBT API, serta meningkatkan efisiensi proses evaluasi pembelajaran di Universitas Ibn Khaldun Bogor.'),
];

const doc = new Document({
    styles: {
        default: { document: { run: { font: TNR, size: 24 } } },
        paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: TNR }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.CENTER } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: TNR }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: TNR }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
        ],
    },
    sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 2268, right: 1701, bottom: 2268, left: 2268 } } },
        children,
    }],
});

Packer.toBuffer(doc).then(b => {
    fs.writeFileSync('./BAB_IV_FINAL.docx', b);
    console.log('File berhasil dibuat: BAB_IV_FINAL.docx');
});