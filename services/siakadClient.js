const jwt = require('jsonwebtoken');

// ==========================================
// 🔌 SIAKAD (NL-SIAK / OBE) CLIENT
// - Kontrak endpoint & bentuk payload di sini disalin dari "Tes Response
//   untuk BE — OBE & Jalur A/C" (dev tool internal SIAKAD), bukan ditebak:
//   POST /api/auth/login (Bearer JWT, bukan shared-secret header) lalu
//   POST /api/akademik/cbt/komponen/:rencanaEvaluasiId/nilai (breakdown per
//   soal) + POST /api/akademik/cbt/nilai-akhir (nilai akhir 0-100), masing2
//   di-key oleh krsId (id enrollment mahasiswa di kelas SIAK, BUKAN NIM).
// - Selama SIAKAD_API_BASE_URL belum diset, semua panggilan disimulasikan
//   (MODE STUB) — sama seperti sebelumnya.
// - searchMataKuliah(): REAL, endpoint publik SIAKAD tanpa auth — tidak
//   berubah dari sebelumnya.
// ==========================================

const SIAKAD_PUBLIC_BASE_URL = 'https://api-siak.uika-bogor.ac.id';
const AKADEMIK_PREFIX = '/api/akademik';
const TOKEN_EXPIRY_SAFETY_MS = 30 * 1000; // re-login 30s sebelum token benar2 expired

let stubWarningLogged = false;
let tokenCache = { token: null, expiresAtMs: 0 };

function hostBaseUrl() {
    return (process.env.SIAKAD_API_BASE_URL || SIAKAD_PUBLIC_BASE_URL).replace(/\/$/, '');
}

function isStubMode() {
    return !process.env.SIAKAD_API_BASE_URL;
}

function warnStubOnce() {
    if (!stubWarningLogged) {
        console.warn('[SIAKAD Client] ⚠️  SIAKAD_API_BASE_URL belum diset — berjalan dalam MODE STUB (tidak benar-benar memanggil SIAKAD).');
        stubWarningLogged = true;
    }
}

async function simulate(label, extra = {}) {
    warnStubOnce();
    console.log(`[SIAKAD Client] 🧪 [STUB] Simulasi ${label}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, simulated: true, ...extra };
}

/**
 * Login sebagai service account CBT ke SIAKAD (POST /api/auth/login),
 * cache token JWT sampai mendekati expired.
 */
async function login() {
    const username = process.env.SIAKAD_ADMIN_USERNAME;
    const password = process.env.SIAKAD_ADMIN_PASSWORD;
    if (!username || !password) {
        throw new Error('SIAKAD_ADMIN_USERNAME / SIAKAD_ADMIN_PASSWORD belum diset di environment.');
    }

    const response = await fetch(`${hostBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.data?.token) {
        throw new Error(`Login SIAKAD gagal: HTTP ${response.status} ${json?.message || ''}`.trim());
    }

    const token = json.data.token;
    const decoded = jwt.decode(token);
    const expiresAtMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 5 * 60 * 1000;
    tokenCache = { token, expiresAtMs };
    return token;
}

async function getToken({ forceRefresh = false } = {}) {
    if (!forceRefresh && tokenCache.token && Date.now() < tokenCache.expiresAtMs - TOKEN_EXPIRY_SAFETY_MS) {
        return tokenCache.token;
    }
    return login();
}

/**
 * Panggil endpoint /api/akademik/... dengan Bearer token, retry 1x setelah
 * re-login kalau kena 401 (token expired/invalid di sisi server).
 */
async function authedRequest(method, path, body, { retryOn401 = true } = {}) {
    const token = await getToken();

    const doFetch = async (bearer) => {
        const res = await fetch(`${hostBaseUrl()}${AKADEMIK_PREFIX}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${bearer}`
            },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let json;
        try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
        return { res, json };
    };

    let { res, json } = await doFetch(token);

    if (res.status === 401 && retryOn401) {
        const freshToken = await getToken({ forceRefresh: true });
        ({ res, json } = await doFetch(freshToken));
    }

    if (!res.ok) {
        const message = (json && json.message) || (typeof json === 'string' ? json : res.statusText);
        return { success: false, message: `SIAKAD HTTP ${res.status}: ${message}` };
    }

    return { success: true, data: json?.data ?? json };
}

/**
 * GET Rencana Evaluasi (komponen evaluasi + master CPMK/Sub-CPMK) satu MK
 * di satu periode — dipakai utk menemukan rencanaEvaluasiId & external_id
 * CPMK/Sub-CPMK sebelum push nilai.
 * @param {string} mkSiakadId - mata_kuliah.siakad_id (uuid SIAK, bukan kode_mk lokal)
 * @param {string} periodeId - siakad_periode_akademik_id
 */
exports.getRencanaEvaluasi = async (mkSiakadId, periodeId) => {
    if (isStubMode()) {
        return simulate(`GET rencana-evaluasi mkSiakadId=${mkSiakadId}`, { data: { rencanaEvaluasi: [], masterCpmk: [] } });
    }
    return authedRequest('GET', `/koordinator-mk/mata-kuliah/${mkSiakadId}/rencana-evaluasi?periodeId=${encodeURIComponent(periodeId)}`);
};

/**
 * GET Pemetaan CPMK (hierarki CPMK -> Sub-CPMK lengkap kode+deskripsi) satu
 * MK — sumber data buat picker "pilih Sub-CPMK langsung dari SIAKAD" saat
 * bikin soal (beda dari masterCpmk di getRencanaEvaluasi yang cuma id+kode,
 * tidak punya deskripsi, dan minta periodeId).
 * @param {string} mkSiakadId - mata_kuliah.siakad_id (uuid SIAK, bukan kode_mk lokal)
 */
exports.getPemetaanCpmk = async (mkSiakadId) => {
    if (isStubMode()) {
        return simulate(`GET pemetaan-cpmk mkSiakadId=${mkSiakadId}`, { data: { cplHeaders: [], cpmkData: [] } });
    }
    return authedRequest('GET', `/obe/mata-kuliah/${mkSiakadId}/pemetaan-cpmk`);
};

/**
 * GET peserta kelas (utk resolve NIM -> krsId sebelum push nilai).
 * @param {string} kelasId - exams.siakad_kelas_kuliah_id
 * @returns {Promise<{success:boolean, data?: Array<{rincianKrsId, nim, nama}>, message?:string}>}
 */
exports.getPesertaKelas = async (kelasId) => {
    if (isStubMode()) {
        return simulate(`GET peserta kelas kelasId=${kelasId}`, { data: [] });
    }
    const result = await authedRequest('GET', `/dosen/kelas/${kelasId}/nilai`);
    if (!result.success) return result;
    return { success: true, data: result.data?.tabel || [] };
};

/**
 * Push breakdown nilai per soal (Jalur D bagian 1) — ephemeral di sisi
 * SIAKAD, replace-not-duplicate kalau dikirim ulang utk krsId yang sama.
 * @param {string} rencanaEvaluasiId - exams.siakad_rencana_evaluasi_id
 * @param {Array<{krsId:string, breakdown:Array<{skorDiperoleh:number, skorMaksimal:number, pemetaanCpmk:Array<{cpmkId:string, bobotPoin:number}>}>}>} daftarNilai
 */
exports.pushKomponenNilai = async (rencanaEvaluasiId, daftarNilai) => {
    if (isStubMode()) {
        return simulate(`POST breakdown komponen rencanaEvaluasiId=${rencanaEvaluasiId} (${daftarNilai.length} mahasiswa)`);
    }
    return authedRequest('POST', `/cbt/komponen/${rencanaEvaluasiId}/nilai`, { daftarNilai });
};

/**
 * Push nilai akhir MK (Jalur D bagian 2) — apa adanya, huruf mutu diturunkan
 * SIAKAD sendiri dari skala penilaian.
 * @param {Array<{krsId:string, nilaiAkhir:number}>} daftarNilai
 */
exports.pushNilaiAkhir = async (daftarNilai) => {
    if (isStubMode()) {
        return simulate(`POST nilai akhir (${daftarNilai.length} mahasiswa)`);
    }
    return authedRequest('POST', `/cbt/nilai-akhir`, { daftarNilai });
};

/**
 * Cari/daftar mata kuliah dari SIAKAD (endpoint publik, tanpa auth).
 * @param {object} params - { page, size }
 * @returns {Promise<{ success: boolean, data?: object[], pagination?: object, message?: string }>}
 */
exports.searchMataKuliah = async ({ page = 1, size = 100 } = {}) => {
    try {
        const response = await fetch(`${hostBaseUrl()}/api/public/mata-kuliah?page=${page}&size=${size}`);

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return { success: false, message: `SIAKAD HTTP ${response.status}: ${text || response.statusText}` };
        }

        const json = await response.json();
        return { success: true, data: json.data || [], pagination: json.pagination || null };
    } catch (error) {
        return { success: false, message: error.message };
    }
};
