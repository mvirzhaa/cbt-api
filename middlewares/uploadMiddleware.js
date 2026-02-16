const multer = require('multer');
const path = require('path');

// Konfigurasi tempat penyimpanan file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Simpan ke folder uploads
    },
    filename: function (req, file, cb) {
        // Format nama: id_user-waktu-namaasli.pdf/jpg
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter hanya boleh upload gambar dan PDF (Best Practice Keamanan)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.jpeg', '.jpg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Hanya diperbolehkan format JPG, PNG, dan PDF!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas maksimal 5MB per file
    fileFilter: fileFilter
});

module.exports = upload;