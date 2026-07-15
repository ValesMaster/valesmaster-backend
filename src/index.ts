import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { connectMongo } from './lib/mongo';
import prisma from './lib/prisma';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('OK');
});

const start = async () => {
    await connectMongo();

    const server = app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

    const gracefulShutdown = async () => {
        console.log('\nCerrando el servidor y las conexiones a bases de datos...');
        await mongoose.connection.close();
        console.log('MongoDB desconectado.');

        await prisma.$disconnect();
        console.log('PostgreSQL desconectado.');

        server.close(() => {
            console.log('Servidor Express apagado.');
            process.exit(0);
        });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
};

start();