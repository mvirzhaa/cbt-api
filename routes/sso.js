const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { addUserToBlacklist, removeUserFromBlacklist } = require('../utils/tokenBlacklist');

const EPORTAL_API = process.env.EPORTAL_URL || 'http://localhost:8000';

// GET /api/sso/callback
router.get('/callback', async (req, res) => {
    const { token, role_id, appModule_id } = req.query;

    if (!token || !role_id || !appModule_id) {
        return res.status(400).json({ status: 400, message: 'Parameter tidak lengkap.' });
    }

    try {
        const { data: eportalRes } = await axios.post(
            `${EPORTAL_API}/api/sso/introspect`,
            {},
            {
                headers: {
                    'X-SSO-Client-ID': process.env.SSO_CLIENT_ID,
                    'X-SSO-Client-Secret': process.env.SSO_CLIENT_SECRET,
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!eportalRes.valid) {
            return res.status(401).json({ status: 401, message: 'Token E-Portal tidak valid.' });
        }

        const eportalUser = eportalRes.user;
        const eportalUserId = eportalUser.sso_id || eportalUser.id;

        // Hapus dari blacklist kalau login ulang
        removeUserFromBlacklist(eportalUserId);

        // Generate token CBT
        const cbtToken = jwt.sign(
            {
                id: eportalUserId,
                email: eportalUser.email,
                role: eportalRes.access?.role_name || eportalUser.institutional_role,
                role_id: parseInt(role_id),
                eportal_user_id: eportalUserId,
                permissions: eportalRes.access?.permissions || [],
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            status: 200,
            message: 'SSO CBT berhasil.',
            data: {
                token: cbtToken,
                user: {
                    id: eportalUserId,
                    email: eportalUser.email,
                    role: eportalRes.access?.role_name || eportalUser.institutional_role,
                    nama: eportalUser.name,
                    permissions: eportalRes.access?.permissions || [],
                }
            }
        });

    } catch (error) {
        console.error('[CBT SSO Error]', error.message);
        return res.status(500).json({ status: 500, message: 'SSO gagal.', debug: error.message });
    }
});

// POST /api/sso/logout
router.post('/logout', async (req, res) => {
    console.log('[SSO Logout] CBT hit, body:', req.body);

    const { user_id, secret } = req.body;
    const validSecret = process.env.EXTERNAL_SYNC_API_KEY || 'secret_sso_uika';

    if (secret !== validSecret) {
        return res.status(401).json({ status: 401, message: 'Invalid secret.' });
    }

    if (!user_id) {
        return res.status(400).json({ status: 400, message: 'user_id wajib diisi.' });
    }

    addUserToBlacklist(user_id);
    console.log(`[SSO Logout] User ${user_id} di-logout dari CBT`);
    return res.json({ status: 200, message: `User ${user_id} berhasil di-logout dari CBT.` });
});

module.exports = router;