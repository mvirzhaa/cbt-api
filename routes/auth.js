const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Base URL: /api
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rute Integrasi External Login
router.post('/auth/external-login', authController.externalLogin);

module.exports = router;
