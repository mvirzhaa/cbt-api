/**
 * Bungkus middleware Multer (single/array/any) supaya error-nya (fileFilter ditolak,
 * limit ukuran terlampaui, dll) direspon sebagai 400 yang bersih — bukan jatuh ke
 * global error handler di index.js sebagai 500 lengkap dengan stack trace ke client.
 */
module.exports = (multerMiddleware, errorKey = 'message') => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (err) {
            return res.status(400).json({ [errorKey]: err.message });
        }
        next();
    });
};
