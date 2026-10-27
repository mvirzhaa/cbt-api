const crypto = require('crypto');
const {
    generateSEBConfig,
    generateConfigKey,
    verifyConfigKeyHash
} = require('@certible/seb-node');

// SEB menyimpan hashedQuitPassword/hashedAdminPassword sebagai SHA256 hex
// UPPERCASE dari passwordnya -- bukan bcrypt, bukan salted. Format ini resmi
// dari spesifikasi .seb (lihat CLAUDE.md bagian SEB Lockdown untuk sumbernya).
function hashSebPassword(password) {
    return crypto.createHash('sha256').update(password, 'utf8').digest('hex').toUpperCase();
}

// Start URL arah langsung ke halaman token (bukan beranda) + token di-prefill
// lewat query string -- supaya "buka .seb -> langsung diminta izin kamera ->
// baca S&K -> ujian mulai", tanpa mahasiswa ngetik ulang token yang memang
// sudah dibagikan ke seluruh kelas (lihat CLAUDE.md, token bukan rahasia per
// mahasiswa, cuma gerbang "tahu kode kelas ini" + jendela waktu). TakeExam.jsx
// cuma PREFILL field dari param ini, bukan auto-submit -- kalau dosen ganti
// token setelah file .seb disebar, mahasiswa masih bisa timpa manual.
function buildExamStartUrl(baseUrl, exam) {
    // "/cbt" di sini BUKAN sembarang path -- harus sama persis dengan
    // basename="/cbt" di cbt-frontend/src/App.jsx (<BrowserRouter
    // basename="/cbt">) dan vite.config.js (base: '/cbt/'). Kalau basename
    // itu pernah diganti, path ini wajib diubah bersamaan.
    const url = new URL('/cbt/take-exam', baseUrl);
    if (exam?.token_ujian) url.searchParams.set('token', exam.token_ujian);
    return url.toString();
}

// X-SafeExamBrowser-ConfigKeyHash dihitung SEB dari URL REQUEST ITU SENDIRI
// (bukan cuma Start URL), jadi header ini ikut nempel di setiap panggilan API
// yang dibuat dari dalam window SEB, ke origin manapun. Reverse-proxy bisa
// bikin req.protocol/host yang Express lihat beda dari yang benar-benar
// diketik browser (SEB) -- makanya utamakan X-Forwarded-* kalau ada, baru
// fallback ke req.protocol/req.get('host') kalau proxy-nya gak kirim itu.
//
// CBT_API_PUBLIC_PATH_PREFIX: sebagian deployment proxy backend ini di bawah
// path, bukan di root domain sendiri (contoh nyata: nginx `location /cbt-api/
// { proxy_pass http://localhost:3003/; }` -- trailing slash di proxy_pass
// bikin nginx STRIP prefix "/cbt-api" sebelum Express sempat melihatnya).
// req.originalUrl jadinya cuma "/api/student/verify-token", padahal SEB
// menghitung hash dari URL publik PENUH "https://domain/cbt-api/api/...".
// Tanpa prefix ini ditempel balik di sini, verifikasi akan gagal 100% kasus,
// bukan cuma di edge case -- isi sesuai prefix path proxy di depan ini kalau
// ada (contoh: "/cbt-api"), kosongkan kalau backend ini sudah di root domain.
function getRequestUrl(req) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const prefix = process.env.CBT_API_PUBLIC_PATH_PREFIX || '';
    return `${proto}://${host}${prefix}${req.originalUrl}`;
}

/**
 * Susun config SEB untuk satu ujian: fullscreen, tidak bisa buka tab/window
 * baru, tidak bisa pindah ke app lain (createNewDesktop -- fitur Windows SEB
 * yang bikin proses ujian jalan di virtual desktop terpisah, ini yang
 * sebenarnya menolak Alt+Tab/Win key, bukan sekadar kiosk mode), dan tidak
 * bisa keluar tanpa quitPassword. File upload (TIPE_4) tetap diizinkan.
 *
 * Setting kunci khusus (F-keys individual, Esc, URL filter per-domain)
 * SENGAJA tidak disentuh di sini -- biarkan default SEB, karena tanpa bisa
 * tes langsung ke client SEB asli, salah tebak semantik satu toggle saja
 * bisa mengunci mahasiswa dari dalam ujiannya sendiri.
 */
async function buildExamSebConfig(exam, { quitPassword } = {}) {
    const baseUrl = process.env.CBT_FRONTEND_EXAM_URL || process.env.CBT_FRONTEND_URL;
    if (!baseUrl) {
        throw new Error("CBT_FRONTEND_URL (atau CBT_FRONTEND_EXAM_URL) belum di-set di .env -- dibutuhkan sebagai Start URL file .seb.");
    }
    const startUrl = buildExamStartUrl(baseUrl, exam);

    const rawConfig = {
        startURL: startUrl,
        browserViewMode: 1, // fullscreen (kiosk)

        allowQuit: !!quitPassword,
        ignoreQuitPassword: false,
        quitURLConfirm: true,
        ...(quitPassword ? { hashedQuitPassword: hashSebPassword(quitPassword) } : {}),

        // Tidak bisa buka tab/window lain
        browserWindowAllowAddressBar: false,
        allowBrowsingBackForward: false,
        newBrowserWindowByLinkPolicy: 0,
        newBrowserWindowByScriptPolicy: 0,
        blockPopUpWindows: true,

        // Tidak bisa pindah ke aplikasi lain / keluar dari sesi terkunci
        createNewDesktop: true,
        allowSwitchToApplications: false,
        allowUserSwitching: false,
        allowVirtualMachine: false,
        enableStartMenu: false,
        allowDeveloperConsole: false,

        // TIPE_4 (upload file) tetap harus bisa jalan di dalam SEB
        allowUploads: true,
        allowDownUploads: true,

        // 🤖 WAJIB: default SEB untuk browserMediaCaptureCamera adalah FALSE --
        // kalau tidak di-set true secara eksplisit, getUserMedia({video:true})
        // yang dipanggil face-api.js di TakeExam.jsx tidak akan pernah muncul
        // dialog izin kamera sama sekali di dalam SEB (proctoring wajah mati
        // total, exam tetap bisa dibuka tapi tanpa pengawasan AI). Mic tidak
        // dipakai proctoring ini, jadi dimatikan eksplisit juga.
        browserMediaCaptureCamera: true,
        browserMediaCaptureMicrophone: false,
    };

    const result = await generateSEBConfig(rawConfig, { encrypt: false, validate: true });
    return { fileBuffer: result.data, normalizedConfig: result.config };
}

// Rakit file .seb dari config yang SUDAH tersimpan di DB (bukan generate
// config baru) -- dipakai dosenController & studentController supaya file
// yang diunduh siapa pun selalu persis sama dengan yang Config Key-nya sudah
// diverifikasi (exam.seb_config adalah satu-satunya sumber kebenaran).
async function generateSebFileBuffer(exam) {
    const result = await generateSEBConfig(exam.seb_config, { encrypt: false, validate: false });
    return result.data;
}

function getConfigKeyForExam(exam) {
    if (!exam || !exam.seb_config) return null;
    return generateConfigKey(exam.seb_config);
}

/**
 * Jembatan hati ujian: kalau exam.seb_require true, request HARUS datang dari
 * SEB asli dengan config yang sama persis dengan yang di-generate dosen
 * (dibuktikan lewat header X-SafeExamBrowser-ConfigKeyHash, bukan cuma
 * User-Agent string yang gampang dipalsukan).
 */
function verifySebRequest(req, exam) {
    if (!exam || !exam.seb_require) return { ok: true };

    const configKey = getConfigKeyForExam(exam);
    if (!configKey) return { ok: false, reason: 'config_missing' };

    const received = req.get('x-safeexambrowser-configkeyhash');
    if (!received) return { ok: false, reason: 'header_missing' };

    const url = getRequestUrl(req);
    return verifyConfigKeyHash(url, configKey, received)
        ? { ok: true }
        : { ok: false, reason: 'hash_mismatch' };
}

module.exports = {
    hashSebPassword,
    buildExamSebConfig,
    buildExamStartUrl,
    generateSebFileBuffer,
    getConfigKeyForExam,
    verifySebRequest,
    getRequestUrl
};
