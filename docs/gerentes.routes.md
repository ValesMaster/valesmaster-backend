# Guía de API: Gerentes e Integrantes (`gerentes.routes.ts`)

Esta guía detalla los endpoints de gestión de empleados y sucursales definidos en [gerentes.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/gerentes.routes.ts).

---

## 1. Consultar Empleados Filtrados (`GET /consultar/empleados`)

### Descripción
Obtiene una lista paginada de usuarios (empleados) activos, con la opción de filtrar por múltiples roles y sucursal. 

* **URL:** `/api/gerentes/consultar/empleados`
* **Método:** `GET`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros de Consulta (`req.query`)
| Campo | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `roles` | String | No | - | Lista de IDs de roles separados por comas (ej. `2,3`). |
| `sucursalId`| String/Number| No | - | Filtra a los empleados asignados a una sucursal específica. |
| `page` | String/Number| No | `1` | Número de página actual para la paginación. |
| `limit` | String/Number| No | `10` | Cantidad de registros devueltos por página. |
| `search` | String | No | - | *Nota:* Aunque se destructura en el controlador, la lógica del filtro no lo implementa en la consulta final a la base de datos. |

### Ejemplos de Petición con Query Params

#### Ejemplo 1: Petición Básica (Valores por defecto)
`GET /api/gerentes/consultar/empleados`

#### Ejemplo 2: Filtrando por Sucursal y Roles, con Paginación Personalizada
`GET /api/gerentes/consultar/empleados?roles=2,4&sucursalId=1&page=2&limit=5`

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "rolId": 2,
      "personaId": 6,
      "username": "mvalidador",
      "email": "validador.juan@example.com",
      "activo": true,
      "intentosFallidos": 0,
      "bloqueadoHasta": null,
      "ipUltimoIntento": "127.0.0.1",
      "createdAt": "2026-08-06T03:22:45.000Z",
      "updatedAt": "2026-08-06T03:22:45.000Z",
      "deletedAt": null,
      "rol": {
        "id": 2,
        "nombre": "Validador",
        "cantidadMfa": 1,
        "createdAt": "2026-08-05T00:00:00.000Z",
        "updatedAt": "2026-08-05T00:00:00.000Z",
        "deletedAt": null
      },
      "persona": {
        "id": 6,
        "nombre": "Manuel",
        "apellidoPaterno": "González",
        "apellidoMaterno": "Ruiz",
        "fechaNacimiento": "1991-12-10T00:00:00.000Z",
        "telefono": "5598765432",
        "genero": "Masculino",
        "curp": "GORM911210HDFNNR02",
        "rfc": "GORM911210XX4",
        "ine": "INE987654321",
        "direccionId": 4,
        "comprobanteDomicilio": null,
        "createdAt": "2026-08-06T03:22:45.000Z",
        "updatedAt": "2026-08-06T03:22:45.000Z",
        "deletedAt": null
      },
      "empleados": [
        {
          "id": 3,
          "sucursalId": 1,
          "usuarioId": 8,
          "createdAt": "2026-08-06T03:22:45.000Z",
          "updatedAt": "2026-08-06T03:22:45.000Z",
          "deletedAt": null,
          "sucursal": {
            "id": 1,
            "nombre": "Sucursal Centro Norte",
            "direccionId": 1,
            "createdAt": "2026-08-05T00:00:00.000Z",
            "updatedAt": "2026-08-05T00:00:00.000Z",
            "deletedAt": null
          }
        }
      ]
    }
  ],
  "pagination": {
    "total": 12,
    "page": 2,
    "limit": 5,
    "totalPages": 3
  }
}
```

#### Respuestas de Error Comunes

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Ocurrió un error interno en el servidor",
    "error": "Detalle técnico del error"
  }
  ```

---

## 2. Detalle de Empleado (`GET /obtener/empleado/:id`)

### Descripción
Obtiene la información completa del perfil de un empleado específico usando su ID único de usuario. Incluye datos de la persona, dirección particular e información de su sucursal de trabajo asignada.

* **URL:** `/api/gerentes/obtener/empleado/:id`
* **Método:** `GET`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros de Ruta (`req.params`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | Number | **Sí** | ID único (`id`) del registro de Usuario. |

### Ejemplo de Petición
`GET /api/gerentes/obtener/empleado/8`

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Empleado consultado con exito",
  "data": {
    "id": 8,
    "rolId": 2,
    "personaId": 6,
    "username": "mvalidador",
    "email": "validador.juan@example.com",
    "activo": true,
    "rol": {
      "id": 2,
      "nombre": "Validador",
      "cantidadMfa": 1
    },
    "persona": {
      "id": 6,
      "nombre": "Manuel",
      "apellidoPaterno": "González",
      "apellidoMaterno": "Ruiz",
      "fechaNacimiento": "1991-12-10T00:00:00.000Z",
      "telefono": "5598765432",
      "genero": "Masculino",
      "direccion": {
        "id": 4,
        "estado": "Jalisco",
        "municipio": "Guadalajara",
        "codigoPostal": "44100",
        "colonia": "Centro",
        "calle": "Av. Juárez",
        "numeroExterior": "150",
        "numeroInterior": "Apt 3",
        "referencia": "Frente al parque"
      }
    },
    "empleados": [
      {
        "id": 3,
        "sucursalId": 1,
        "sucursal": {
          "id": 1,
          "nombre": "Sucursal Centro Norte"
        }
      }
    ]
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Empleado inactivo)**
  ```json
  {
    "message": "Este empleado no esta activo en el sistema"
  }
  ```

* **`404 Not Found` (El ID de empleado no existe)**
  ```json
  {
    "message": "Empleado no encontrado"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al obtener el detalle del empleado",
    "error": "Detalle del error"
  }
  ```

---

## 3. Crear Nuevo Empleado (`POST /crear/empleado`)

### Descripción
Registra a un nuevo integrante del equipo. A través de una transacción en base de datos, este endpoint crea en bloque la Dirección, la Persona, las credenciales del Usuario y vincula al nuevo usuario como Empleado de una sucursal con un Rol específico.

* **URL:** `/api/gerentes/crear/empleado`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
Recibe una estructura plana que se distribuye a las diferentes tablas:

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `nombre` | String | **Sí** | Nombre(s) del nuevo empleado. |
| `apellido_paterno`| String | **Sí** | Apellido paterno. |
| `apellido_materno`| String | No | Apellido materno. |
| `fecha_nacimiento`| String | **Sí** | Fecha en formato ISO o string convertible (ej: `1985-03-24`). |
| `telefono` | String | **Sí** | Teléfono de contacto. |
| `genero` | String | **Sí** | Género de la persona. |
| `estado` | String | **Sí** | Estado de la dirección del empleado. |
| `municipio` | String | **Sí** | Municipio o alcaldía de la dirección. |
| `codigo_postal`| String | **Sí** | Código postal. |
| `colonia` | String | **Sí** | Colonia. |
| `calle` | String | **Sí** | Calle. |
| `numero_exterior`| String | **Sí** | Número exterior de domicilio. |
| `numero_interior`| String | No | Número interior de domicilio. |
| `referencia` | String | No | Indicaciones especiales de la dirección. |
| `rol_id` | Number | **Sí** | ID del rol del empleado (ej. `2` para Validador, `3` para Coordinador). |
| `username` | String | **Sí** | Nombre de usuario de acceso. |
| `email` | String | **Sí** | Correo electrónico de acceso. |
| `password` | String | **Sí** | Contraseña de acceso (será cifrada en el servidor). |
| `sucursal_id` | Number | **Sí** | ID de la sucursal a la que pertenecerá el empleado. |

### Ejemplo de Petición
```json
{
  "nombre": "Ana Maria",
  "apellido_paterno": "Sánchez",
  "apellido_materno": "Gutiérrez",
  "fecha_nacimiento": "1992-08-15",
  "telefono": "3312345678",
  "genero": "Femenino",
  "estado": "Jalisco",
  "municipio": "Zapopan",
  "codigo_postal": "45010",
  "colonia": "Las Águilas",
  "calle": "Av. Patria",
  "numero_exterior": "1200",
  "numero_interior": "Int 4",
  "referencia": "Cerca del Templo",
  "rol_id": 2,
  "username": "anasanchez",
  "email": "ana.sanchez@example.com",
  "password": "Password123!",
  "sucursal_id": 1
}
```

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Empleado creado exitosamente",
  "data": {
    "empleadoCreado": {
      "id": 5,
      "sucursalId": 1,
      "usuarioId": 14,
      "createdAt": "2026-08-06T06:22:45.000Z",
      "updatedAt": "2026-08-06T06:22:45.000Z",
      "deletedAt": null,
      "usuario": {
        "id": 14,
        "rolId": 2,
        "personaId": 12,
        "username": "anasanchez",
        "email": "ana.sanchez@example.com",
        "activo": true,
        "intentosFallidos": 0,
        "bloqueadoHasta": null,
        "ipUltimoIntento": null,
        "createdAt": "2026-08-06T06:22:45.000Z",
        "updatedAt": "2026-08-06T06:22:45.000Z",
        "deletedAt": null,
        "persona": {
          "id": 12,
          "nombre": "Ana Maria",
          "apellidoPaterno": "Sánchez",
          "apellidoMaterno": "Gutiérrez",
          "fechaNacimiento": "1992-08-15T00:00:00.000Z",
          "telefono": "3312345678",
          "genero": "Femenino",
          "curp": null,
          "rfc": null,
          "ine": null,
          "direccionId": 8,
          "comprobanteDomicilio": null,
          "createdAt": "2026-08-06T06:22:45.000Z",
          "updatedAt": "2026-08-06T06:22:45.000Z",
          "deletedAt": null
        },
        "rol": {
          "id": 2,
          "nombre": "Validador",
          "cantidadMfa": 1,
          "createdAt": "2026-08-05T00:00:00.000Z",
          "updatedAt": "2026-08-05T00:00:00.000Z",
          "deletedAt": null
        }
      },
      "sucursal": {
        "id": 1,
        "nombre": "Sucursal Centro Norte",
        "direccionId": 1,
        "createdAt": "2026-08-05T00:00:00.000Z",
        "updatedAt": "2026-08-05T00:00:00.000Z",
        "deletedAt": null
      }
    },
    "rolNombre": "Validador",
    "cantidadMfa": 1
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Duplicidad en campos únicos como email o username)**
  ```json
  {
    "success": false,
    "message": "El registro ya existe en el sistema (conflicto en campo único): usuarios_username_key"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "success": false,
    "message": "Ocurrió un error interno al registrar el empleado"
  }
  ```
