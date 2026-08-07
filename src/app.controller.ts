import { Controller, Get } from '@nestjs/common';
import mongoose from 'mongoose';
import prisma from './lib/prisma';

@Controller()
export class AppController {
    @Get()
    status() {
        return {
            status: 'ok',
            service: 'valesmaster-backend',
            framework: 'NestJS'
        };
    }

    @Get('api/health')
    async health() {
        const postgres = await prisma.$queryRaw`SELECT 1`
            .then(() => true)
            .catch(() => false);
        const mongo = mongoose.connection.readyState === 1;

        return {
            ...this.status(),
            status: postgres ? (mongo ? 'ok' : 'degraded') : 'unavailable',
            dependencies: { postgres, mongo }
        };
    }
}
