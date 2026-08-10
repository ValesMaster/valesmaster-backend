import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const poolRead = new pg.Pool({
    connectionString: process.env.DATABASE_URL_READ || process.env.DATABASE_URL,
});

const adapterRead = new PrismaPg(poolRead);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaRead: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

// Cliente de solo lectura contra el esclavo, para endpoints que solo leen (listados/detalle).
// No usar antes de un write en el mismo flujo: el lag de replicación puede devolver datos desactualizados.
export const prismaRead = globalForPrisma.prismaRead || new PrismaClient({ adapter: adapterRead });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaRead = prismaRead;
}

export default prisma;