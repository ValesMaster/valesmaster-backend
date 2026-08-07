import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import mongoose from 'mongoose';
import prisma from './lib/prisma';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
    private readonly logger = new Logger(DatabaseLifecycleService.name);

    async onApplicationShutdown() {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            this.logger.log('MongoDB desconectado');
        }

        await prisma.$disconnect();
        this.logger.log('PostgreSQL desconectado');
    }
}
