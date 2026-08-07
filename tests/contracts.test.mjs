import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('arranca mediante NestJS y conserva los contratos públicos', async () => {
    const [main, appModule, solicitudes, auth] = await Promise.all([
        readFile(new URL('src/main.ts', root), 'utf8'),
        readFile(new URL('src/app.module.ts', root), 'utf8'),
        readFile(new URL('src/controllers/solicitudes.controller.ts', root), 'utf8'),
        readFile(new URL('src/controllers/auth.controller.ts', root), 'utf8')
    ]);

    assert.match(main, /NestFactory\.create\(AppModule\)/);
    assert.match(appModule, /ConfigModule\.forRoot/);
    for (const route of ['crear', 'validar/:id', 'obtener-presolicitudes', 'detalle-presolicitud/:id']) {
        assert.match(solicitudes, new RegExp(route.replaceAll('/', '\\/')));
    }
    assert.match(auth, /@Post\('login'\)/);
    assert.match(auth, /httpOnly:\s*true/);
});

test('documenta variables sin incluir secretos reales', async () => {
    const envExample = await readFile(new URL('.env.example', root), 'utf8');
    for (const variable of ['DATABASE_URL=', 'MONGO_URI=', 'JWT_SECRET=', 'FRONTEND_URL=']) {
        assert.match(envExample, new RegExp(variable));
    }
    assert.doesNotMatch(envExample, /ghp_[A-Za-z0-9]{20,}/);
    assert.doesNotMatch(envExample, /postgresql:\/\/[^\s]+:[^\s]+@/);
});
