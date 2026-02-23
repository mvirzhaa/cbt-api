const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

// 1. Satpam Pengecek Karcis (Validasi Token JWT)
exports.verifyToken = (req, res, next) => {
    // Ambil token dari header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: "Akses ditolak! Token tidak ditemukan." });
    }

    try {
        // Cek keaslian token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Simpan data user (id, role) ke dalam request
        next(); // Lanjut ke proses berikutnya
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
