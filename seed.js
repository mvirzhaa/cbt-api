const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // Kita hash password 'rahasia123' agar aman di database
    const hashedPassword = await bcrypt.hash('rahasia123', 10);

    // Upsert: Bikin akun super admin
    const superAdmin = await prisma.users.upsert({
        where: { email: 'superadmin@cbt.com' },
        update: {},
        create: {
            nama: 'Bapak Super Admin',
            email: 'superadmin@cbt.com',
            password: hashedPassword,
            role: 'super_admin',
            status_aktif: true
        },
    });
    console.log('✅ Super Admin berhasil disinkronisasi:', superAdmin.email);

    // Upsert: Bikin akun Dosen
    const dosen = await prisma.users.upsert({
        where: { email: 'dosen@cbt.com' },
        update: {},
        create: {
            nama: 'Dr. Dosen Penguji',
            email: 'dosen@cbt.com',
            password: hashedPassword,
            role: 'dosen',
            status_aktif: true
        },
    });
    console.log('✅ Dosen berhasil disinkronisasi:', dosen.email);

    // Upsert: Bikin akun Mahasiswa
    const mahasiswa = await prisma.users.upsert({
        where: { email: 'mahasiswa@cbt.com' },
        update: {},
        create: {
            nama: 'Mahasiswa Teladan',
            email: 'mahasiswa@cbt.com',
            nim: '12345678',
            password: hashedPassword,
            role: 'mahasiswa',
            status_aktif: true
        },
    });
    console.log('✅ Mahasiswa berhasil disinkronisasi:', mahasiswa.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });