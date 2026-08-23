import prisma from '../src/lib/prisma'

async function main() {
    console.log('Iniciando el seeder de prisma...');

    const roles = [
        { nombre: 'cajero', cantidadMfa: 1 },
        { nombre: 'validador', cantidadMfa: 3 },
        { nombre: 'gerente_sucursal', cantidadMfa: 3 },
        { nombre: 'gerente_general', cantidadMfa: 3 },
        { nombre: 'coordinador', cantidadMfa: 3 },
        { nombre: 'distribuidora', cantidadMfa: 1 },
        { nombre: 'administrador', cantidadMfa: 3 }
    ]

    for (const rol of roles) {
        const rolCreado = await prisma.rol.upsert({
            where: { nombre: rol.nombre },
            update: {},
            create: {
                nombre: rol.nombre,
                cantidadMfa: rol.cantidadMfa
            },
        });

        console.log(`Rol verificado/creado: ${rolCreado.nombre} (MFA: ${rolCreado.cantidadMfa})`)
    }

    console.log('Seeder finalizado con exito');
}

main()
    .catch((e) => {
        console.error('Error durante el seeder:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });