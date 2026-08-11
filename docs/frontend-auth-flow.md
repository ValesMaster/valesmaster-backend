# Guía Frontend: Flujo Completo de Autenticación

Esta guía explica cómo debe integrar el frontend el login multi-factor de ValesMaster. No es un solo "método" de login: es una **cascada de hasta 3 factores** controlada por el campo `cantidadMfa` del rol del usuario, que el frontend descubre dinámicamente a partir de la respuesta del backend (no hay que hardcodear por rol).

Endpoints involucrados:

| Paso | Endpoint | Controller |
| :--- | :--- | :--- |
| 1. Password | `POST /api/auth/login` | [auth.controller.ts](../src/controllers/auth.controller.ts) → `loginPhaseOne` |
| 2. TOTP (setup, primera vez) | `POST /api/totp/setup`, `POST /api/totp/enable` | [totp.controller.ts](../src/controllers/totp.controller.ts) |
| 2. TOTP (login recurrente) | `POST /api/totp/verify` | [totp.controller.ts](../src/controllers/totp.controller.ts) → `verifyTotpLogin` |
| 3. Preguntas de seguridad (primera vez) | `POST /api/security/setup` | [security.controller.ts](../src/controllers/security.controller.ts) → `setupSecurityQuestions` |
| 3. Preguntas de seguridad (repetición) | `POST /api/security/questions`, `POST /api/security/verify` | [security.controller.ts](../src/controllers/security.controller.ts) |

---

## 1. Concepto: máquina de estados por `step`

Cada respuesta exitosa de login trae un campo `step` que le dice al frontend qué pantalla mostrar a continuación. El frontend debe tratar el login como una máquina de estados, **no** como una sola llamada:

```mermaid
flowchart TD
    A[POST /api/auth/login] -->|step: COMPLETED| Z[accessToken final]
    A -->|step: REQUIRE_TOTP| B{"¿Usuario ya tiene TOTP confirmado?"}
    B -->|No| C[POST /api/totp/setup + /api/totp/enable]
    C --> D[POST /api/totp/verify]
    B -->|Sí| D
    D -->|step: COMPLETED| Z
    D -->|step: REQUIRE_SECURITY| G{"¿Usuario ya tiene preguntas configuradas?"}
    G -->|No| H[POST /api/security/setup]
    H --> Z
    G -->|Sí| E[POST /api/security/questions]
    E --> F[POST /api/security/verify]
    F -->|step: COMPLETED| Z
```

- `cantidadMfa === 1` → login termina en el paso 1.
- `cantidadMfa === 2` → login pasa por password + TOTP.
- `cantidadMfa === 3` → login pasa por password + TOTP + preguntas de seguridad.

El frontend **no necesita saber** de antemano cuántos factores tiene el rol: simplemente reacciona al `step` que devuelve cada respuesta.

### ¿Cómo sabe el front si es la primera vez que el usuario configura TOTP o preguntas de seguridad?

El backend se lo dice explícitamente, **no hay que adivinarlo ni sondear otros endpoints**:

- La respuesta con `step: "REQUIRE_TOTP"` (de `/api/auth/login`) incluye `totpConfigured: boolean`.
- La respuesta con `step: "REQUIRE_SECURITY"` (de `/api/totp/verify`) incluye `securityQuestionsConfigured: boolean`.

`false` → primera vez, mostrar la pantalla de setup (4a / 5a). `true` → ya configurado, mostrar la pantalla de verificación (4b / 5b). Esto evita tener que llamar a `/verify` sin saber todavía qué código pedirle al usuario, o disparar efectos secundarios (como crear un secreto TOTP pendiente) solo para "probar" el estado.

---

## 2. Tipos de token que vas a manejar

| Token | Dónde se emite | Payload | Vigencia | Para qué sirve |
| :--- | :--- | :--- | :--- | :--- |
| `mfaToken` (REQUIRE_TOTP) | `loginPhaseOne` | `{ id, step: "REQUIRE_TOTP", mfaRequired }` | 5 min | Verificar TOTP (`/api/totp/verify`) **o** configurar TOTP por primera vez (`/api/totp/setup`, `/api/totp/enable`) |
| `mfaToken` (REQUIRE_SECURITY) | `verifyTotpLogin` | `{ id, step: "REQUIRE_SECURITY" }` | 5 min | Configurar preguntas por primera vez (`/api/security/setup`) **o** obtener/responder preguntas ya existentes (`/api/security/questions`, `/api/security/verify`) |
| `accessToken` | `loginPhaseOne`, `verifyTotpLogin` o `verifySecurityQuestions` (el que cierre el último factor) | `{ id, rol }` | 8 h | Sesión completa. Se envía en `Authorization: Bearer <accessToken>` |

**Importante:** el nombre `mfaToken` se reutiliza para dos propósitos distintos (TOTP pendiente vs. preguntas de seguridad pendientes). Para saber cuál es cuál, el frontend debe guardarse el `step` que vino junto con el token en la misma respuesta — no intentes inferirlo del token en sí.

Los 5 minutos de vigencia del `mfaToken` son cortos: diseña la UI para que el usuario entre directo a la pantalla de TOTP/preguntas apenas recibe el token, y maneja el caso de expiración (ver sección 6).

---

## 3. Paso 1 — Login con password

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "juan.perez@example.com", "password": "PasswordSegura123!" }
```

Respuestas posibles:

- **`200` `step: "COMPLETED"`** → ya tenés `accessToken`, terminaste. Guardalo y andá directo a la app.
- **`200` `step: "REQUIRE_TOTP"`** → guardá `mfaToken`. La respuesta también trae `totpConfigured: boolean`: si es `false` andá a 4a (setup), si es `true` andá a 4b (verify). **No lo adivines ni lo sondees** — usá ese campo directamente.
- **`401`** credenciales inválidas o contraseña incorrecta (mismo mensaje genérico por seguridad, no reveles cuál campo falló en la UI).
- **`403`** cuenta bloqueada (5 intentos fallidos → 15 min). Viene con `bloqueadoHasta` (ISO date) para mostrar countdown.
- **`500`** error interno.

---

## 4. Paso 2 — TOTP

### 4a. Primera vez (el usuario no tiene TOTP configurado)

Usá el **mismo `mfaToken`** que recibiste en el paso 1 (step `REQUIRE_TOTP`) como `Authorization: Bearer <mfaToken>` — no hace falta un accessToken completo para este bootstrap inicial:

```http
POST /api/totp/setup
Authorization: Bearer <mfaToken>
```
→ `200` con `{ qr, secret, secretId }`. Mostrá el `qr` (ya viene como data URL base64) para que el usuario lo escanee con Google Authenticator/Authy.

```http
POST /api/totp/enable
Authorization: Bearer <mfaToken>
Content-Type: application/json

{ "code": "845120" }
```
→ `200` confirma el TOTP. Después de esto, continuá al login normal de TOTP (4b) con el mismo `mfaToken` (todavía dentro de la ventana de 5 min) o hacé que el usuario vuelva a loguearse.

### 4b. Login recurrente (el usuario ya tiene TOTP confirmado)

```http
POST /api/totp/verify
Content-Type: application/json

{ "mfaToken": "<mfaToken del paso 1>", "code": "392014" }
```

Respuestas:
- **`200` `step: "COMPLETED"`** → `accessToken` final, listo.
- **`200` `step: "REQUIRE_SECURITY"`** → guardá el nuevo `mfaToken` (¡es otro token, para preguntas de seguridad!) y andá al paso 3. La respuesta trae `securityQuestionsConfigured: boolean`: `false` → 5a (setup), `true` → 5b (verify).
- **`400`** usuario sin TOTP configurado → no debería pasar si ya usaste `totpConfigured` para decidir la pantalla, pero mandalo a 4a igual como red de seguridad (ej. si el usuario desconfiguró el TOTP en otra pestaña).
- **`401`** código incorrecto, o el `mfaToken` es inválido/expiró (mensaje distinto según el caso — ver sección 6).
- **`404`** usuario no encontrado.

---

## 5. Paso 3 — Preguntas de seguridad (solo `cantidadMfa === 3`)

### 5a. Primera vez (el usuario no tiene preguntas configuradas)

Usá el `mfaToken` (step `REQUIRE_SECURITY`) que te dio `/api/totp/verify` para elegir la(s) pregunta(s) e ingresar la(s) respuesta(s) en un solo paso — se guardan y la sesión se completa de inmediato, sin necesidad de llamar a `/verify` después:

```http
POST /api/security/setup
Content-Type: application/json

{
  "mfaToken": "<mfaToken del paso 2>",
  "securityQuestions": [
    { "question": "¿Nombre de tu primera mascota?", "answer": "Firulais" }
  ]
}
```
→ **`201`** con `{ step: "COMPLETED", accessToken }` — listo, sesión iniciada.

- **`400`** falta `mfaToken`, no se mandó ninguna pregunta, o alguna pregunta viene sin `question`/`answer`.
- **`401`** `mfaToken` inválido/expirado.
- **`404`** usuario no encontrado.
- **`409`** el usuario ya tiene preguntas configuradas (tiene que usar 5b, no este endpoint).

### 5b. Repetición (el usuario ya tiene preguntas configuradas)

```http
POST /api/security/questions
Content-Type: application/json

{ "mfaToken": "<mfaToken del paso 2>" }
```
→ `200` con `{ questions: [{ id, question }] }` — pedí una respuesta por cada una, **en el mismo orden**.

```http
POST /api/security/verify
Content-Type: application/json

{ "mfaToken": "<mismo mfaToken>", "answers": ["respuesta1", "respuesta2"] }
```

Respuestas:
- **`200` `step: "COMPLETED"`** → `accessToken` final.
- **`400`** faltan respuestas, no coincide la cantidad, o el usuario no tiene preguntas configuradas (→ mandalo a 5a).
- **`401`** respuestas incorrectas, o `mfaToken` inválido/expirado.
- **`404`** usuario no encontrado.

---

## 6. Manejo de errores — igual en los 3 factores

Después del fix aplicado en agosto 2026, los tres controllers (`auth`, `totp`, `security`) distinguen de forma consistente:

| Status | Significado | Qué debe hacer el frontend |
| :--- | :--- | :--- |
| `400` | Falta un campo obligatorio en el body (`mfaToken`, `code`, `answers`, etc.) | Error de validación de formulario, no reinicies el flujo |
| `401` | Token de MFA/sesión inválido **o expirado** (`TokenExpiredError`/`JsonWebTokenError`), o credenciales/código/respuestas incorrectas | Si es token expirado (ventana de 5 min agotada): **reiniciar el login desde el paso 1**. Si es código/respuesta incorrecta: dejar reintentar en la misma pantalla |
| `403` | Cuenta bloqueada temporalmente | Mostrar `bloqueadoHasta` |
| `404` | Usuario no encontrado (normalmente el `id` del token ya no existe) | Reiniciar el login desde el paso 1 |
| `409` | Recurso duplicado (`/api/auth/register`) / TOTP ya configurado (`/api/totp/setup`) / preguntas de seguridad ya configuradas (`/api/security/setup`) | Mostrar mensaje específico y redirigir al flujo de "repetición" correspondiente |
| `500` | Error real de servidor | Mensaje genérico de "intenta más tarde" |

El body de error siempre tiene la forma `{ "message": "..." }` en estos tres controllers — podés parsear `message` de forma uniforme para toda la UI de auth (no aplica al resto de la API, que usa shapes distintos: `{success, data}` en `gerentes`, `{message, data}` en `solicitudes`).

**Nota práctica:** como el `mfaToken` dura solo 5 minutos, vas a ver `401` por expiración con cierta frecuencia si el usuario tarda en escribir el código. Diseñá la pantalla de TOTP/preguntas con un mensaje claro tipo "tu sesión de verificación expiró, volvé a iniciar sesión" en vez de tratarlo como error genérico.

---

## 7. Sesión completa

Una vez que tenés el `accessToken` (venga del paso 1, 2 o 3), guardalo (ej. memoria + refresh vía login, no hay refresh token todavía) y mandalo en cada request protegida:

```http
Authorization: Bearer <accessToken>
```

Expira a las 8 horas sin mecanismo de refresh — al recibir `401` en cualquier endpoint protegido con este token, mandá al usuario de vuelta al login completo.

---

## 8. Pseudocódigo de referencia (frontend)

```ts
async function login(email: string, password: string) {
  const res = await api.post('/api/auth/login', { email, password });

  if (res.data.step === 'COMPLETED') return saveSession(res.data.accessToken);

  if (res.data.step === 'REQUIRE_TOTP') {
    return res.data.totpConfigured
      ? goToTotpVerifyScreen(res.data.mfaToken)   // 4b
      : goToTotpSetupScreen(res.data.mfaToken);   // 4a
  }
}

// 4a — primera vez: mostrar QR (/setup) y luego confirmar código (/enable)
async function submitTotp(mfaToken: string, code: string) {
  const res = await api.post('/api/totp/verify', { mfaToken, code });
  if (res.data.step === 'COMPLETED') return saveSession(res.data.accessToken);

  if (res.data.step === 'REQUIRE_SECURITY') {
    return res.data.securityQuestionsConfigured
      ? goToSecurityVerifyScreen(res.data.mfaToken)  // 5b
      : goToSecuritySetupScreen(res.data.mfaToken);  // 5a
  }
}

// 5a — primera vez: elegir pregunta(s) + respuesta(s)
async function submitSecuritySetup(mfaToken: string, securityQuestions: { question: string; answer: string }[]) {
  const res = await api.post('/api/security/setup', { mfaToken, securityQuestions });
  if (res.data.step === 'COMPLETED') return saveSession(res.data.accessToken);
}

// 5b — repetición: responder pregunta(s) ya configuradas
async function submitSecurityAnswers(mfaToken: string, answers: string[]) {
  const res = await api.post('/api/security/verify', { mfaToken, answers });
  if (res.data.step === 'COMPLETED') return saveSession(res.data.accessToken);
}
```

En todos los casos, un `401` en la llamada indica código/respuesta incorrecta o `mfaToken` vencido (ver sección 6) — manejalo en el `catch`, no como parte del flujo feliz.

---

## 9. Limitaciones actuales a tener en cuenta al planear el frontend

- Fuera de `/api/totp/setup` y `/api/totp/enable`, **ninguna otra ruta del backend valida el `accessToken`** todavía (rutas de `gerentes` y `solicitudes` son anónimas). No asumas que mandar el header alcanza para "proteger" esas pantallas del lado del cliente únicamente.
- `/api/security/setup` no requiere un segundo secreto compartido más allá del `mfaToken` — cualquiera con ese token (válido 5 min, emitido solo tras pasar password+TOTP) puede fijar la pregunta/respuesta. Es el mismo nivel de confianza que ya tenía el bootstrap de TOTP, pero tenlo presente si más adelante se agrega recuperación de cuenta.
- No hay refresh token: a las 8h el usuario tiene que volver a loguearse desde cero.
- `POST /api/auth/register` está abierto sin autenticación (pensado solo para pruebas) — no lo expongas en la UI de producción.
- CORS del backend no incluye `PATCH` en `methods` ([index.ts](../src/index.ts)), lo que rompe el preflight de `PATCH /api/gerentes/desactivar/empleado/:id` si lo llamás desde el browser. Hay que corregirlo en el backend antes de usar ese endpoint desde el frontend.
