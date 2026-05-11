const multer = require('multer');
const path = require('path');

// Pengaturan lokasi penyimpanan dan nama file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Pastikan folder 'uploads' sudah ada di root backend
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Penjaga Gerbang (Filter Format File)
const fileFilter = (req, file, cb) => {
    // 🌟 PERBAIKAN: Pisahkan regex Ekstensi dan Mimetype agar DOCX dan ZIP yang aneh tetap lolos
    const extRegex = /jpeg|jpg|png|pdf|zip|doc|docx/;
    const mimeRegex = /jpeg|jpg|png|pdf|zip|x-zip-compressed|msword|wordprocessingml/;
    
    // Cek ekstensi file (hilangkan titik dan ubah ke lowercase)
    const extname = extRegex.test(path.extname(file.originalname).toLowerCase());
    // Cek mime type bawaan file
    const mimetype = mimeRegex.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true); // Lolos!
    } else {
        cb(new Error('Format file ditolak! Hanya diperbolehkan JPG, PNG, PDF, ZIP, atau Word (DOC/DOCX).'), false); // Ditolak!
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Batas maksimal 5MB
});

module.exports = upload;