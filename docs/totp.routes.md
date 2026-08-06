# Guía de API: Autenticación de Doble Factor (`totp.routes.ts`)

Esta guía detalla los endpoints para la gestión y verificación del Segundo Factor de Autenticación (MFA/TOTP) definidos en [totp.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/totp.routes.ts).

---

## 1. Configuración de TOTP (`POST /setup`)

### Descripción
Genera un nuevo secreto TOTP (encriptado temporalmente) y códigos de recuperación para el usuario autenticado. Devuelve el código QR en formato Base64 para ser escaneado por una aplicación autenticadora (Google Authenticator, Authy, etc.).

* **URL:** `/api/totp/setup`
* **Método:** `POST`
* **Headers:** 
  * `Authorization: Bearer <accessToken>` (Requerido)
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
No requiere cuerpo de petición.

### Ejemplo de Petición
* **Headers:**
  ```http
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
* **Body:** (Vacío)

### Respuestas

#### Respuesta Exitosa (`200 OK`)
Devuelve la imagen del QR en base64 y el secreto en formato Base32 para configuración manual.
```json
{
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwAQAAAAD...",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

#### Respuestas de Error Comunes

* **`401 Unauthorized` (Token no enviado o inválido)**
  ```json
  {
    "message": "Token requerido"
  }
  ```

* **`404 Not Found` (Usuario no existe)**
  ```json
  {
    "message": "Usuario no encontrado"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error interno"
  }
  ```

---

## 2. Habilitar / Confirmar TOTP (`POST /enable`)

### Descripción
Habilita oficialmente el segundo factor de autenticación para el usuario. Compara el código OTP dinámico provisto por el usuario contra el secreto previamente generado en `/setup`. Si el código es correcto, marca la configuración TOTP como confirmada.

* **URL:** `/api/totp/enable`
* **Método:** `POST`
* **Headers:** 
  * `Authorization: Bearer <accessToken>` (Requerido)
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `code` | String | **Sí** | Código temporal de 6 dígitos que muestra el autenticador (ej. `123456`). |

### Ejemplo de Petición
* **Headers:**
  ```http
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
* **Body:**
  ```json
  {
    "code": "845120"
  }
  ```

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "TOTP habilitado"
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Código dinámico incorrecto o expirado)**
  ```json
  {
    "message": "Código inválido"
  }
  ```

* **`401 Unauthorized` (Token faltante o inválido)**
  ```json
  {
    "message": "Token requerido"
  }
  ```

* **`404 Not Found` (No se ha iniciado una configuración previa con `/setup`)**
  ```json
  {
    "message": "No existe TOTP"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Mensaje específico de error"
  }
  ```

---

## 3. Verificar Código TOTP en Login (`POST /verify`)

### Descripción
Paso dos del flujo de inicio de sesión con autenticación de doble factor. Se utiliza cuando el login en fase uno (`/api/auth/login`) responde con `"step": "REQUIRE_TOTP"`. Recibe el token temporal `mfaToken` y el código OTP ingresado por el usuario para finalmente otorgar el `accessToken` de sesión definitivo.

* **URL:** `/api/totp/verify`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `mfaToken` | String | **Sí** | El token de autenticación temporal provisto en la fase 1 del login. |
| `code` | String | **Sí** | Código dinámico de 6 dígitos de la app autenticadora. |

### Ejemplo de Petición
```json
{
  "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwic3RlcCI6IlJFUVVJUkVfVE9UUCIsIm1mYVJlcXVpcmVkIjoyLCJpYXQiOjE3ODE1NTAwMDB9.mfaSignature...",
  "code": "392014"
}
```

### Respuestas

#### Respuesta Exitosa (`200 OK`)
Valida el código y devuelve el token de acceso definitivo para interactuar con la API con la sesión iniciada.
```json
{
  "step": "COMPLETED",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sIjoiR2VyZW50ZSIsImlhdCI6MTc4MTU1MTAwMCwiZXhwIjoxNzgxNTc5ODAwfQ.finalSignature..."
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (TOTP no activado o confirmado previamente)**
  ```json
  {
    "message": "No existe TOTP configurado"
  }
  ```

* **`401 Unauthorized` (Código ingresado incorrecto)**
  * Registra el intento fallido de autenticación de factor 2 en los logs de la base de datos.
  ```json
  {
    "message": "Código incorrecto"
  }
  ```

* **`404 Not Found` (Usuario incrustado en el `mfaToken` no existe)**
  ```json
  {
    "message": "Usuario no encontrado"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error interno"
  }
  ```
