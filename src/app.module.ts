import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthController } from './controllers/auth.controller';
import { GerentesController } from './controllers/gerentes.controller';
import { SolicitudesController } from './controllers/solicitudes.controller';
import { TotpController } from './controllers/totp.controller';
import { validateEnvironment } from './config/environment';
import { DatabaseLifecycleService } from './database-lifecycle.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment
        })
    ],
    controllers: [
        AppController,
        AuthController,
        TotpController,
        SolicitudesController,
        GerentesController
    ],
    providers: [DatabaseLifecycleService]
})
export class AppModule {}
