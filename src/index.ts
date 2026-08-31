import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { connectMongo } from './lib/mongo';
import prisma from './lib/prisma';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.routes';
import totpRoutes from './routes/totp.routes';
import securityRoutes from "./routes/security.routes";
import solicitudesRoutes from './routes/solicitudes.routes';
import gerentesRoutes from './routes/gerentes.routes';
import distribuidorasRoutes from './routes/distribuidoras.routes';
import sucursalesRoutes from './routes/sucursal.routes';
import auditRoutes from './routes/audits.routes';
import cajerasRoutes from './routes/cajeras.routes';
import valesRoutes from './routes/vales.routes';
import cambiosRoutes from './routes/cambios.routes';

var cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        credentials: true
    }
});

app.set('io', io);

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
}));

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('OK');
});

app.use('/api/auth', authRoutes);
app.use('/api/totp', totpRoutes);
app.use("/api/security", securityRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/gerentes', gerentesRoutes);
app.use('/api/distribuidoras', distribuidorasRoutes)
app.use("/api/sucursales", sucursalesRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/cajeras', cajerasRoutes);
app.use('/api/vales', valesRoutes);
app.use('/api/cambios', cambiosRoutes);

io.on('connection', (socket) => {
    console.log(`Usuario conectado por WebSocket: ${socket.id}`);

    socket.on('join_empleado', (empleadoId: number) => {
        socket.join(`empleado_${empleadoId}`);
        console.log(`Socket ${socket.id} se unió a la sala: empleado_${empleadoId}`);
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
    });
});

const start = async () => {
    await connectMongo();

    server.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

    const gracefulShutdown = async () => {
        console.log('\nCerrando el servidor y las conexiones a bases de datos...');

        io.close(() => {
            console.log('Servidor WebSocket cerrado');
        })

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