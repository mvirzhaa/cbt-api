const { isUserBlacklisted } = require('../utils/tokenBlacklist');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

// 1. Satpam Pengecek Karcis (Validasi Token JWT)
exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Akses ditolak! Token tidak ditemukan." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.userId && !decoded.id) decoded.id = decoded.userId;
        else if (decoded.id && !decoded.userId) decoded.userId = decoded.id;

        // ← cek blacklist
        const userIdToCheck = decoded.eportal_user_id || decoded.id;
        if (isUserBlacklisted(userIdToCheck)) {
            return res.status(401).json({ message: "Session telah berakhir. Silakan login kembali." });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: "Token tidak valid atau sudah kedaluwarsa!" });
    }
};

// 2. Satpam Pengecek Pangkat (Khusus Admin / Super Admin)
exports.isAdmin = (req, res, next) => {
    // Pastikan user sudah melewati verifyToken
    if (!req.user) {
        return res.status(401).json({ message: "Harus login terlebih dahulu!" });
    }

    // Cek role
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Akses Ditolak! Anda bukan Admin." });
    }

    next(); // Lolos, silakan masuk!
};

// 3. Satpam Pengecek Pangkat (Khusus Dosen - untuk nanti buat ujian)
exports.isDosen = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Harus login terlebih dahulu!" });
    
    if (req.user.role !== 'dosen') {
        return res.status(403).json({ message: "Akses Ditolak! Fitur ini khusus Dosen." });
    }
    next();
};

exports.isDosenOrSuperAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Harus login terlebih dahulu!" });

    if (req.user.role !== 'dosen' && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Akses Ditolak! Fitur ini khusus Dosen/Super Admin." });
    }

    next();
};
