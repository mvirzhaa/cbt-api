// ==========================================
// 🔌 SIAKAD CLIENT
// - pushNilai(): STUB — satu-satunya titik yang perlu diisi ulang begitu kontrak
//   API push-nilai final. Selama SIAKAD_API_BASE_URL belum diset, disimulasikan.
// - searchMataKuliah(): REAL — endpoint publik SIAKAD yang kontraknya sudah
//   dikonfirmasi (GET /api/public/mata-kuliah, tanpa secret), jadi langsung
//   memanggil API asli, tidak lewat mode stub.
// ==========================================

const SIAKAD_PUBLIC_BASE_URL = 'https://api-siak.uika-bogor.ac.id';

let stubWarningLogged = false;

/**
 * Push satu komponen nilai mahasiswa ke SIAKAD.
 * @param {object} payload - { attempt_id, nim, kode_mk, siakad_kelas_kuliah_id, siakad_periode_akademik_id, komponen_nilai }
 * @returns {Promise<{ success: boolean, simulated?: boolean, message?: string }>}
 */
exports.pushNilai = async (payload) => {
    const baseUrl = process.env.SIAKAD_API_BASE_URL;

    if (!baseUrl) {
        if (!stubWarningLogged) {
            console.warn('[SIAKAD Client] ⚠️  SIAKAD_API_BASE_URL belum diset — berjalan dalam MODE STUB (nilai tidak benar-benar dikirim).');
            stubWarningLogged = true;
        }
        console.log(`[SIAKAD Client] 🧪 [STUB] Simulasi push nilai attempt_id=${payload.attempt_id}, nim=${payload.nim}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, simulated: true };
    }

    try {
        const response = await fetch(`${baseUrl}/api/nilai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Siakad-Secret': process.env.SIAKAD_SHARED_SECRET || ''
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return { success: false, message: `SIAKAD HTTP ${response.status}: ${text || response.statusText}` };
        }

        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Cari/daftar mata kuliah dari SIAKAD (endpoint publik, tanpa auth).
 * @param {object} params - { page, size }
 * @returns {Promise<{ success: boolean, data?: object[], pagination?: object, message?: string }>}
 */
exports.searchMataKuliah = async ({ page = 1, size = 100 } = {}) => {
    const baseUrl = process.env.SIAKAD_API_BASE_URL || SIAKAD_PUBLIC_BASE_URL;

    try {
        const response = await fetch(`${baseUrl}/api/public/mata-kuliah?page=${page}&size=${size}`);

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
