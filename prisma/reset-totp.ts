// Script de mantenimiento: resetea el MFA completo de un usuario (TOTP y
// preguntas de seguridad) para forzar que la proxima vez que inicie sesion
// tenga que configurar todo de nuevo desde cero (escanear QR + registrar
// preguntas de seguridad).
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

    const preguntasEliminadas = await prisma.securityQuestion.deleteMany({
        where: { userId: usuario.id }
    });

    console.log(`Usuario encontrado: ${usuario.username} (${usuario.email}), rol: ${usuario.rol.nombre}`);
    console.log(`TotpSecrets eliminados: ${secretosEliminados.count}`);
    console.log(`SecurityQuestions eliminadas: ${preguntasEliminadas.count}`);
    console.log('Listo. En el siguiente login a este usuario le va a pedir escanear el QR y registrar preguntas de seguridad desde cero.');
}

main()
    .catch((e) => {
        console.error('Error al resetear el MFA:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
