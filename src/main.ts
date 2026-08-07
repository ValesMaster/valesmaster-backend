import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { connectMongo } from './lib/mongo';

async function bootstrap() {
    const mongoConnected = await connectMongo();

    const app = await NestFactory.create(AppModule);
    const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    app.enableCors({
        origin: frontendOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true
    });
    app.enableShutdownHooks();

    const port = Number(process.env.PORT ?? 2552);
    await app.listen(port);
    Logger.log(`Servidor NestJS disponible en http://localhost:${port}`, 'Bootstrap');
    if (!mongoConnected) {
        Logger.warn('La bitacora MongoDB esta deshabilitada hasta corregir sus credenciales', 'Bootstrap');
    }
}

void bootstrap();
