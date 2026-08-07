# ValesMaster Backend

API oficial de ValesMaster migrada a NestJS, con Prisma/PostgreSQL para la operación y MongoDB para bitácoras. Mantiene los contratos HTTP existentes para que los clientes actuales continúen funcionando.

## Requisitos

- Node.js 22 o superior
- PostgreSQL 17
- MongoDB

## Configuración local

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run dev
```

Completa `.env` con credenciales locales y nunca lo agregues al repositorio. La aplicación valida al iniciar `DATABASE_URL`, `MONGO_URI` y `JWT_SECRET`.

Variables principales:

- `PORT`: puerto HTTP, `2552` por defecto.
- `FRONTEND_URL`: uno o varios orígenes CORS separados por coma.
- `DATABASE_URL`: conexión de Prisma a PostgreSQL.
- `MONGO_URI`: conexión de la bitácora a MongoDB.
- `JWT_SECRET`: firma de tokens de acceso y MFA.
- `SMTP_*` y `MAIL_FROM`: cuenta de salida de correo.

## Comandos

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run start:prod
```

La verificación de salud está disponible en `GET /api/health`. Si MongoDB no está disponible, NestJS continúa sirviendo la API y reporta un estado degradado; PostgreSQL sigue siendo la dependencia operativa principal.

## Contratos conservados

- `POST /api/auth/login`
- `POST /api/totp/verify`
- `GET /api/solicitudes/obtener-presolicitudes`
- `GET /api/solicitudes/detalle-presolicitud/:id`
- `POST /api/solicitudes/crear`
- `POST /api/solicitudes/validar/:id`
- `GET /api/gerentes/consultar/empleados`

Consulta los ejemplos completos en [`docs/`](docs/).
