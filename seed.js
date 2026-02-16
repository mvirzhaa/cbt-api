const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // Kita hash password 'rahasia123' agar aman di database
    const hashedPassword = await bcrypt.hash('rahasia123', 10);

    // Upsert: Bikin akun baru jika belum ada, abaikan jika sudah ada
    const superAdmin = await prisma.users.upsert({
        where: { email: 'superadmin@cbt.com' },
        update: {},
        create: {
            nama: 'Bapak Super Admin',
            email: 'superadmin@cbt.com',
            password: hashedPassword,
            role: 'super_admin',
            status_aktif: true // Super admin langsung aktif tanpa perlu di-ACC
        },
    });
    console.log('✅ Super Admin berhasil disinkronisasi:', superAdmin.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });