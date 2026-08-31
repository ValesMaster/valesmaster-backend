// Script de mantenimiento: resetea el TOTP de un usuario para forzar que
// la proxima vez que inicie sesion tenga que volver a escanear el QR.
//
// Uso:
//   npx tsx prisma/reset-totp.ts <username_o_email>
//
// OJO: esto corre contra la base de datos que apunte tu DATABASE_URL en
// este momento (revisa tu .env antes de correrlo si no estas seguro).

import prisma from '../src/lib/prisma';

async function main() {
    const identificador = process.argv[2];

    if (!identificador) {
        console.error('Uso: npx tsx prisma/reset-totp.ts <username_o_email>');
        process.exit(1);
    }

    const usuario = await prisma.usuario.findFirst({
        where: {
            OR: [
                { username: identificador },
                { email: identificador }
            ]
        },
        include: { rol: true }
    });

    if (!usuario) {
        console.error(`No se encontro ningun usuario con username/email: ${identificador}`);
        process.exit(1);
    }

    const secretosEliminados = await prisma.totpSecret.deleteMany({
        where: { userId: usuario.id }
    });

    console.log(`Usuario encontrado: ${usuario.username} (${usuario.email}), rol: ${usuario.rol.nombre}`);
    console.log(`TotpSecrets eliminados: ${secretosEliminados.count}`);
    console.log('Listo. En el siguiente login a este usuario le va a pedir escanear el QR de nuevo.');
}

main()
    .catch((e) => {
        console.error('Error al resetear el TOTP:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
