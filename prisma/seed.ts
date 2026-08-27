import bcrypt from 'bcrypt'
import prisma from '../src/lib/prisma'

const GERENTE_USERNAME = 'gerentelaguna';
const GERENTE_EMAIL = 'gerente.laguna@valesmaster.com';
const GERENTE_PASSWORD = 'Gerente123!';

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

    let sucursalLaguna = await prisma.sucursal.findFirst({
        where: { nombre: 'Laguna', deletedAt: null }
    });

    if (!sucursalLaguna) {
        const direccionLaguna = await prisma.direccion.create({
            data: {
                estado: 'Coahuila',
                municipio: 'Torreon',
                codigoPostal: '27000',
                colonia: 'Centro',
                calle: 'Av. Juarez',
                numeroExterior: '100'
            }
        });

        sucursalLaguna = await prisma.sucursal.create({
            data: {
                nombre: 'Laguna',
                direccionId: direccionLaguna.id
            }
        });

        console.log(`Sucursal creada: ${sucursalLaguna.nombre} (id: ${sucursalLaguna.id})`);
    } else {
        console.log(`Sucursal ya existente: ${sucursalLaguna.nombre} (id: ${sucursalLaguna.id})`);
    }

    const rolGerenteGeneral = await prisma.rol.findUnique({
        where: { nombre: 'gerente_general' }
    });

    if (!rolGerenteGeneral) {
        throw new Error("No se encontro el rol 'gerente_general', revisa el seed de roles");
    }

    const usuarioGerenteExistente = await prisma.usuario.findUnique({
        where: { username: GERENTE_USERNAME }
    });

    if (!usuarioGerenteExistente) {
        const hashedPassword = await bcrypt.hash(GERENTE_PASSWORD, 10);

        const personaGerente = await prisma.persona.create({
            data: {
                nombre: 'Gerente',
                apellidoPaterno: 'General',
                apellidoMaterno: 'Laguna'
            }
        });

        const usuarioGerente = await prisma.usuario.create({
            data: {
                username: GERENTE_USERNAME,
                email: GERENTE_EMAIL,
                password: hashedPassword,
                rolId: rolGerenteGeneral.id,
                personaId: personaGerente.id
            }
        });

        await prisma.empleado.create({
            data: {
                sucursalId: sucursalLaguna.id,
                usuarioId: usuarioGerente.id
            }
        });

        console.log(`Usuario gerente general creado: ${GERENTE_USERNAME} / ${GERENTE_PASSWORD} (email: ${GERENTE_EMAIL})`);
    } else {
        console.log(`Usuario gerente general ya existente: ${GERENTE_USERNAME}`);
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