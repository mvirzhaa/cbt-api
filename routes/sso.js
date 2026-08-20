const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { addUserToBlacklist, removeUserFromBlacklist } = require('../utils/tokenBlacklist');

const prisma = new PrismaClient();
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

        // FIX 2026-08-21: sebelumnya endpoint ini gak pernah nyentuh tabel `users`
        // lokal CBT -- JWT langsung dibikin pakai id/role mentah dari E-Portal, jadi
        // gak pernah nyambung ke akun CBT manapun (riwayat ujian kosong, submit/verify
        // gagal FK constraint karena user_id itu gak ada row-nya di CBT). Sekarang
        // cari-atau-buat user lokal berdasarkan email, pola sama persis kayak
        // exports.externalLogin di authController.js (integrasi TIAS) yang sudah
        // dipakai & terbukti jalan -- biar kedua jalur SSO konsisten.
        const institutionalRole = (eportalRes.access?.role_name || eportalUser.institutional_role || eportalUser.role || '').toUpperCase();
        // Whitelist ketat sama kayak externalLogin: cuma dosen/mahasiswa yang boleh
        // auto-provisioning lewat SSO. admin/super_admin CBT tetap harus dibuat manual.
        const safeRole = institutionalRole.includes('DOSEN') ? 'dosen' : 'mahasiswa';

        let user = await prisma.users.findUnique({ where: { email: eportalUser.email } });

        if (!user) {
            user = await prisma.users.create({
                data: {
                    email: eportalUser.email,
                    nama: eportalUser.name || eportalUser.email,
                    nim: eportalUser.npm || null,
                    // Password acak karena login hanya lewat SSO, gak pernah dipakai
                    password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
                    role: safeRole,
                    status_aktif: true // Langsung aktif, identitasnya sudah divalidasi E-Portal
                }
            });
        } else {
            // Sinkronkan role tiap login SSO (E-Portal sumber kebenaran terbaru) + isi nim
            // kalau belum ada. Role admin/super_admin CBT sengaja TIDAK disentuh di sini.
            const dataToUpdate = {};
            if ((user.role === 'dosen' || user.role === 'mahasiswa') && user.role !== safeRole) {
                dataToUpdate.role = safeRole;
            }
            if (!user.nim && eportalUser.npm) {
                dataToUpdate.nim = eportalUser.npm;
            }
            if (Object.keys(dataToUpdate).length > 0) {
                user = await prisma.users.update({ where: { id: user.id }, data: dataToUpdate });
            }
        }

        // Generate token CBT -- pakai id LOKAL (bukan id mentah E-Portal) supaya semua
        // query `user_id` di seluruh aplikasi CBT nyambung ke akun yang benar.
        const cbtToken = jwt.sign(
            {
                id: user.id,
                userId: user.id,
                email: user.email,
                role: user.role,
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
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    nama: user.nama,
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