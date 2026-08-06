# Guía de API: Autenticación (`auth.routes.ts`)

Esta guía detalla los endpoints de autenticación definidos en [auth.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/auth.routes.ts). Estos endpoints gestionan el registro de usuarios de prueba y el inicio de sesión en dos fases (con soporte para MFA/TOTP).

---

## 1. Registro de Usuario de Prueba (`POST /register`)

### Descripción
Registra un nuevo usuario en la base de datos vinculando información de Persona y Dirección. **Nota:** Este método está diseñado para crear usuarios de prueba y configurar sus roles iniciales para validar el flujo de inicio de sesión de múltiples factores.

* **URL:** `/api/auth/register` (o la ruta base correspondiente a `auth.routes.ts`)
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros
No recibe parámetros en la URL ni query params (`req.query` o `req.params`).

### Cuerpo de la Petición (`req.body`)
Recibe un objeto JSON con la información del usuario, la persona y su dirección.

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `email` | String | **Sí** | Correo electrónico único del usuario. |
| `username` | String | **Sí** | Nombre de usuario único para inicio de sesión. |
| `password` | String | **Sí** | Contraseña del usuario (será cifrada con bcrypt). |
| `rolId` | Number | **Sí** | ID del rol que tendrá el usuario (debe existir en la tabla `roles`). |
| `curp` | String | **Sí** | CURP de la persona asociada (18 caracteres). |
| `rfc` | String | **Sí** | RFC de la persona asociada (13 caracteres). |
| `nombres` | String | No | Nombres de pila de la persona. |
| `apellidoPaterno`| String | No | Apellido paterno de la persona. |
| `apellidoMaterno`| String | No | Apellido materno de la persona. |
| `fechaNacimiento`| String | No | Fecha de nacimiento en formato de fecha (ej. `YYYY-MM-DD`). |
| `genero` | String | No | Género (ej. `Masculino`, `Femenino`). |
| `telefono` | String | No | Número telefónico de la persona. |
| `ine` | String | No | Clave de elector o identificación oficial. |
| `estado` | String | No | Estado de residencia. |
| `municipio` | String | No | Municipio de residencia. |
| `colonia` | String | No | Colonia de residencia. |
| `codigoPostal` | String | No | Código postal. |
| `calle` | String | No | Calle. |
| `numeroExterior` | String | No | Número exterior del domicilio. |
| `referencia` | String | No | Indicaciones o referencias de ubicación. |

### Ejemplo de Petición
```json
{
  "email": "juan.perez@example.com",
  "username": "juanperez",
  "password": "PasswordSegura123!",
  "rolId": 2,
  "nombres": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "Gómez",
  "fechaNacimiento": "1994-05-15",
  "genero": "Masculino",
  "curp": "PEGO940515HDFRRN01",
  "rfc": "PEGO940515XX1",
  "telefono": "5512345678",
  "ine": "INE1234567890",
  "estado": "Ciudad de México",
  "municipio": "Coyoacán",
  "colonia": "Del Carmen",
  "codigoPostal": "04100",
  "calle": "Londres",
  "numeroExterior": "24",
  "referencia": "Esquina con calle Allende"
}
```

### Respuestas

#### Respuesta Exitosa (`201 Created`)
Devuelve el mensaje de confirmación y el objeto del usuario creado con algunos datos estructurados de la persona.
```json
{
  "message": "Usuario registrado correctemente",
  "user": {
    "id": 5,
    "email": "juan.perez@example.com",
    "username": "juanperez",
    "rol": "Validador",
    "mfaRequerido": 1,
    "persona": {
      "nombreCompleto": "Juan Pérez Gómez",
      "curp": "PEGO940515HDFRRN01",
      "rfc": "PEGO940515XX1"
    }
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Faltan campos obligatorios)**
  ```json
  {
    "message": "Faltan campos obligatorios"
  }
  ```

* **`400 Bad Request` (Rol inexistente)**
  ```json
  {
    "message": "El rol especificado no existe"
  }
  ```

* **`409 Conflict` (Registro duplicado - CURP/RFC/Email/Username)**
  ```json
  {
    "message": "Error de duplicidad: El campo (email) ya está registrado en el sistema."
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error interno del servidor al registrar el usuario"
  }
  ```

---

## 2. Inicio de Sesión - Fase Uno (`POST /login`)

### Descripción
Realiza la autenticación primaria con correo electrónico y contraseña. Si el rol del usuario requiere Multi-Factor Authentication (MFA) con TOTP (cuando `cantidadMfa` es mayor a 1), el servidor devuelve un estado de espera (`REQUIRE_TOTP`) y un token temporal `mfaToken` para completar la verificación en la fase dos. Si solo requiere 1 factor (contraseña tradicional), el inicio de sesión se completa y entrega el `accessToken` definitivo.

* **URL:** `/api/auth/login`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `email` | String | **Sí** | Correo electrónico del usuario. |
| `password` | String | **Sí** | Contraseña del usuario. |

### Ejemplo de Petición
```json
{
  "email": "juan.perez@example.com",
  "password": "PasswordSegura123!"
}
```

### Respuestas

#### Respuesta Exitosa (Flujo Sin MFA / Acceso Directo) (`200 OK`)
Ocurre cuando el rol asignado al usuario solo requiere 1 factor de autenticación.
```json
{
  "step": "COMPLETED",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sIjoiVmFsaWRhZG9yIiwiaWF0IjoxNzgxNTUwMDAwLCJleHAiOjE3ODE1Nzg4MDB9.someSignature..."
}
```

#### Respuesta Exitosa (Flujo Con MFA / Requiere TOTP) (`200 OK`)
Ocurre cuando el rol del usuario tiene configurado `cantidadMfa > 1` (ej. Gerentes, Administradores). Se debe usar el `mfaToken` en el endpoint `/verify` de la ruta de TOTP.
```json
{
  "step": "REQUIRE_TOTP",
  "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwic3RlcCI6IlJFUVVJUkVfVE9UUCIsIm1mYVJlcXVpcmVkIjoyLCJpYXQiOjE3ODE1NTAwMDB9.mfaSignature...",
  "message": "Por favor ingrese su codigo de autenticacion"
}
```

#### Respuestas de Error Comunes

* **`401 Unauthorized` (Credenciales inválidas - Correo no registrado)**
  ```json
  {
    "message": "Credenciales invalidas"
  }
  ```

* **`401 Unauthorized` (Contraseña incorrecta)**
  ```json
  {
    "message": "Contrasena incorrecta"
  }
  ```

* **`403 Forbidden` (Cuenta bloqueada temporalmente por excesivos intentos fallidos)**
  * Se bloquea la cuenta tras superar 5 intentos fallidos durante 15 minutos.
  ```json
  {
    "message": "Esta cuenta esta bloqueada por demasiados intentos",
    "bloqueadoHasta": "2026-08-06T06:32:45.123Z"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error interno del servidor"
  }
  ```
