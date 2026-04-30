const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

// Base URL: /api/admin/users
router.put('/:id/approve', verifyToken, isAdmin, adminController.approveUser);
router.get('/pending', verifyToken, isAdmin, adminController.getPendingUsers);
router.get('/active', verifyToken, isAdmin, adminController.getActiveUsers);
router.delete('/:id', verifyToken, isAdmin, adminController.deleteUser);

module.exports = router;
