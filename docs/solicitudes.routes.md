# Guía de API: Solicitudes y Presolicitudes (`solicitudes.routes.ts`)

Esta guía detalla los endpoints relacionados con el ciclo de vida de las solicitudes de crédito para distribuidoras definidos en [solicitudes.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/solicitudes.routes.ts). El flujo general de este apartado consta de tres etapas principales:

1. **Creación de Presolicitud**: Datos generales del solicitante con referencias de vehículos, negocios y familiares.
2. **Validación de Presolicitud**: Revisión por parte de un empleado "Validador" para cambiar el estado a `VALIDADA` o `RECHAZADA` (si se valida, se crea automáticamente una Solicitud).
3. **Aprobación de Solicitud**: Aprobación final por parte de un "Gerente" que promueve al solicitante a "Distribuidora" activa con línea de crédito y accesos al sistema.

---

## 1. Crear Presolicitud (`POST /crear`)

### Descripción
Crea una nueva presolicitud registrando en bloque la información de la Persona, su Dirección, y sus relaciones complejas de vehículos, negocios y familiares directos.

* **URL:** `/api/solicitudes/crear`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Cuerpo de la Petición (`req.body`)
Recibe un objeto JSON con estructuras anidadas para vehículos, negocios y familiares:

| Campo / Objeto | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| **Datos de Persona** | | | |
| `nombre` | String | **Sí** | Nombre(s) del solicitante. |
| `apellido_paterno`| String | **Sí** | Apellido paterno. |
| `apellido_materno`| String | No | Apellido materno. |
| `fecha_nacimiento`| String | **Sí** | Fecha de nacimiento (ej. `YYYY-MM-DD`). |
| `telefono` | String | **Sí** | Teléfono de contacto. |
| `genero` | String | **Sí** | Género (ej. `Femenino`, `Masculino`). |
| `curp` | String | **Sí** | CURP del solicitante. |
| `rfc` | String | **Sí** | RFC del solicitante. |
| `ine` | String | No | Identificación INE o pasaporte. |
| `comprobante_domicilio` | String | No | Ruta o enlace al comprobante de domicilio. |
| **Datos de Dirección** | | | |
| `estado` | String | **Sí** | Estado. |
| `municipio` | String | **Sí** | Municipio o alcaldía. |
| `codigo_postal`| String | **Sí** | Código Postal. |
| `colonia` | String | **Sí** | Colonia. |
| `calle` | String | **Sí** | Calle. |
| `numero_exterior`| String | **Sí** | Número exterior. |
| `numero_interior`| String | No | Número interior. |
| `referencia` | String | No | Referencias físicas del domicilio. |
| **Datos de Presolicitud** | | | |
| `sucursal_id` | Number | **Sí** | ID de la sucursal de vinculación. |
| `coordinador_id`| Number | No | ID del empleado coordinador asignado. |
| `correo_solicitante`| String| **Sí** | Correo electrónico de contacto de la futura distribuidora. |
| **Colecciones Anidadas** | | | |
| `vehiculos` | Array | No | Colección de vehículos del solicitante (ver estructura abajo). |
| `negocios` | Array | **Sí** | Colección de negocios del solicitante (mínimo 1 requerido). |
| `familiares` | Array | **Sí** | Colección de familiares directos (mínimo 1 requerido). |

#### Estructura de Objetos de la Colección `vehiculos` (Opcional)
* `marca` (String): Marca del vehículo (ej: `Toyota`).
* `modelo` (String): Submarca/Modelo (ej: `Corolla`).
* `placas` (String): Placas de circulación.
* `ano` (String): Año de fabricación.
* `color` (String): Color del auto.
* `tipoVehiculo` (String): Tipo de carrocería (ej: `Sedán`, `Pick-up`).

#### Estructura de Objetos de la Colección `negocios` (Requerido)
* `nombre` (String): Nombre comercial del negocio.
* `sucursal` (String): Ubicación o sucursal del negocio.
* `telefono` (String): Teléfono del negocio.
* `carta` (String): Documento/Carta de constancia.
* `antiguedad` (String): Fecha de antigüedad del negocio (formato fecha, ej. `2018-05-20`).

#### Estructura de Objetos de la Colección `familiares` (Requerido)
* `nombre` (String): Nombre(s) del familiar.
* `apellido_paterno` (String): Apellido paterno.
* `apellido_materno` (String): Apellido materno.
* `telefono` (String): Teléfono del familiar.
* `relacion` (String): Relación de parentesco (ej. `Padre`, `Madre`, `Hermano/a`).

### Ejemplo de Petición
```json
{
  "nombre": "Carlos",
  "apellido_paterno": "Ruiz",
  "apellido_materno": "Espinoza",
  "fecha_nacimiento": "1988-11-23",
  "telefono": "3339876543",
  "genero": "Masculino",
  "curp": "RUEC881123HDFXNS01",
  "rfc": "RUEC881123XX3",
  "ine": "INE-CARLOS-RUIZ",
  "comprobante_domicilio": "comprobante_carlos.pdf",
  "estado": "Jalisco",
  "municipio": "Zapopan",
  "codigo_postal": "45130",
  "colonia": "Constitución",
  "calle": "Manuel M. Diéguez",
  "numero_exterior": "124",
  "numero_interior": null,
  "referencia": "A espaldas de la primaria",
  "sucursal_id": 1,
  "coordinador_id": 2,
  "correo_solicitante": "carlos.ruiz@example.com",
  "vehiculos": [
    {
      "marca": "Nissan",
      "modelo": "Versa",
      "placas": "JXY-98-34",
      "ano": "2020",
      "color": "Gris",
      "tipoVehiculo": "Sedán"
    }
  ],
  "negocios": [
    {
      "nombre": "Abarrotes Don Carlos",
      "sucursal": "Zapopan Centro",
      "telefono": "3331112222",
      "carta": "carta_constancia.pdf",
      "antiguedad": "2015-09-01"
    }
  ],
  "familiares": [
    {
      "nombre": "María Luisa",
      "apellido_paterno": "Espinoza",
      "apellido_materno": "Velasco",
      "telefono": "3335556666",
      "relacion": "Madre"
    }
  ]
}
```

### Respuestas

#### Respuesta Exitosa (`201 Created`)
Devuelve la información de la presolicitud registrada junto a su folio único autogenerado (prefijo `PRE-` + 6 dígitos numéricos).
```json
{
  "message": "Presolicitud creada con exito",
  "data": {
    "id": 12,
    "folio": "PRE-923845",
    "personaId": 24,
    "sucursalId": 1,
    "validadorId": null,
    "coordinadorId": 2,
    "estado": "PENDIENTE",
    "correoSolicitante": "carlos.ruiz@example.com",
    "createdAt": "2026-08-06T06:22:45.000Z",
    "updatedAt": "2026-08-06T06:22:45.000Z",
    "deletedAt": null
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Falta colección de familiares)**
  ```json
  {
    "message": "Es necesario registrar a los familiares directos del solicitante"
  }
  ```

* **`400 Bad Request` (Falta colección de negocios)**
  ```json
  {
    "message": "Es necesario registrar los negocios en los que el solicitante ha estado"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al crear la presolicitud",
    "error": "Detalle técnico del error"
  }
  ```

---

## 2. Validar Presolicitud (`POST /validar/:id`)

### Descripción
Permite a un integrante con rol de Validador aprobar (`VALIDADA`) o rechazar (`RECHAZADA`) la veracidad de la información de una presolicitud. Si se aprueba, se genera automáticamente una nueva **Solicitud** vinculada a la presolicitud con el estado `PENDIENTE` (esperando aprobación final del Gerente).

* **URL:** `/api/solicitudes/validar/:id`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros de Ruta (`req.params`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | Number | **Sí** | ID único (`id`) de la Presolicitud a validar. |

### Cuerpo de la Petición (`req.body`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `validador_id`| Number | **Sí** | ID único de Empleado del validador que procesa la petición. |
| `estado` | String | **Sí** | Debe ser estrictamente `'VALIDADA'` o `'RECHAZADA'`. |

### Ejemplo de Petición
* **URL:** `/api/solicitudes/validar/12`
* **Body:**
```json
{
  "validador_id": 4,
  "estado": "VALIDADA"
}
```

### Respuestas

#### Respuesta Exitosa (`200 OK` - Validada)
```json
{
  "message": "Solicitud validada con exito",
  "data": {
    "presolicitudActualizada": {
      "id": 12,
      "folio": "PRE-923845",
      "estado": "VALIDADA",
      "validadorId": 4,
      "persona": { "id": 24, "nombre": "Carlos", ... },
      "validador": {
        "id": 4,
        "usuario": { "username": "carlosvalidador", "email": "validador@company.com" }
      }
    },
    "nuevaSolicitud": {
      "id": 5,
      "presolicitudId": 12,
      "estado": "PENDIENTE",
      "gerenteId": null,
      "createdAt": "2026-08-06T06:28:10.000Z"
    }
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Estado de validación inválido)**
  ```json
  {
    "message": "Estado invalido",
    "error": "El estado debe ser VALIDADA o RECHAZADA"
  }
  ```

* **`404 Not Found` (Presolicitud inexistente)**
  ```json
  {
    "message": "Presolicitud no encontrada"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al validar presolicitud",
    "error": "..."
  }
  ```

---

## 3. Aprobar/Rechazar Solicitud (`POST /aprobar/:id`)

### Descripción
Proceso de decisión final por parte de un Gerente sobre una Solicitud cuya información ya fue previamente validada. 
* **Si el estado es `APROBADA`**: Se crea un nuevo Usuario con Rol de Distribuidora (Rol ID `6`), una nueva entidad de Distribuidora con línea de crédito inicial ($10,000.00 COP/MXN por defecto) y categoría 'Cobre', y se migran automáticamente los registros de vehículos, negocios y familiares desde la presolicitud hacia la distribuidora.
* **Si el estado es `RECHAZADA`**: Solo se cambia el estado de la Solicitud.

* **URL:** `/api/solicitudes/aprobar/:id`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros de Ruta (`req.params`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | Number | **Sí** | ID único (`id`) del registro de la Solicitud (no de la presolicitud). |

### Cuerpo de la Petición (`req.body`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `estado` | String | **Sí** | Debe ser `'APROBADA'` o `'RECHAZADA'`. |
| `gerente_id` | Number | **Sí** | ID de Empleado del gerente que autoriza. |
| `user_name` | String | Solo si es `APROBADA` | Nombre de usuario de acceso para la nueva distribuidora. |
| `user_password`| String| Solo si es `APROBADA` | Contraseña que usará la distribuidora para iniciar sesión. |

### Ejemplo de Petición (Aprobación)
* **URL:** `/api/solicitudes/aprobar/5`
* **Body:**
```json
{
  "estado": "APROBADA",
  "gerente_id": 1,
  "user_name": "carlos_distribuidora",
  "user_password": "DistribuidoraPass123!"
}
```

### Respuestas

#### Respuesta Exitosa (`200 OK` - Solicitud Aprobada)
```json
{
  "message": "Distribuidora aprobada y creada con exito",
  "data": {
    "solicitudActualizada": {
      "id": 5,
      "presolicitudId": 12,
      "gerenteId": 1,
      "estado": "APROBADA"
    },
    "usuarioDistribuidora": {
      "id": 28,
      "rolId": 6,
      "personaId": 24,
      "username": "carlos_distribuidora",
      "email": "carlos.ruiz@example.com",
      "activo": true
    },
    "nuevaDistribuidora": {
      "id": 3,
      "usuarioId": 28,
      "sucursalId": 1,
      "puntos": 0,
      "limiteCredito": 10000,
      "creditoUsado": 0,
      "cantidadLiquidada": 0,
      "categoria": "Cobre"
    }
  }
}
```

#### Respuestas de Error Comunes

* **`400 Bad Request` (Estado incorrecto o presolicitud no validada todavía)**
  ```json
  {
    "message": "Los datos de la presolicitud deben estar validados para aprobar la solicitud"
  }
  ```

* **`404 Not Found` (Solicitud o presolicitud relacionada no encontrada)**
  ```json
  {
    "message": "No se encontro la solicitud"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al aprobar presolicitud",
    "error": "..."
  }
  ```

---

## 4. Obtener Solicitudes (`GET /obtener-solicitudes`)

### Descripción
Obtiene un listado paginado y formateado de las Solicitudes creadas. Permite filtrar por su estado y/o el gerente asignado.

* **URL:** `/api/solicitudes/obtener-solicitudes`
* **Método:** `GET`

### Parámetros de Consulta (`req.query`)
| Campo | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `page` | String/Number | No | `'1'` | Página solicitada. |
| `limit` | String/Number | No | `'10'` | Registros por página. |
| `estado` | String | No | - | Filtro de estado (ej: `PENDIENTE`, `APROBADA`, `RECHAZADA`). Insensible a mayúsculas/minúsculas. |
| `gerente_id` | String/Number | No | - | Filtro para obtener solicitudes procesadas por un gerente específico. |

### Ejemplos de Petición con Query Params
* `GET /api/solicitudes/obtener-solicitudes?estado=pendiente&page=1&limit=5`
* `GET /api/solicitudes/obtener-solicitudes?gerente_id=1`

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Solicitudes obtenidas con éxito",
  "data": [
    {
      "id": 5,
      "folioPresolicitud": "PRE-923845",
      "nombreSolicitante": "Carlos Ruiz",
      "gerenteId": 1,
      "nombreGerente": "gerente1",
      "estado": "APROBADA",
      "createdAt": "2026-08-06T06:28:10.000Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

## 5. Obtener Presolicitudes (`GET /obtener-presolicitudes`)

### Descripción
Obtiene un listado paginado y formateado de las Presolicitudes del sistema. Permite filtrar por estado, sucursal, y realizar búsquedas de texto.

* **URL:** `/api/solicitudes/obtener-presolicitudes`
* **Método:** `GET`

### Parámetros de Consulta (`req.query`)
| Campo | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `page` | String/Number | No | `'1'` | Página solicitada. |
| `limit` | String/Number | No | `'10'` | Registros por página. |
| `estado` | String | No | - | Filtro de estado de la presolicitud (ej: `PENDIENTE`, `VALIDADA`, `RECHAZADA`). |
| `sucursal_id`| String/Number | No | - | Filtro por ID de la sucursal de procedencia. |
| `search` | String | No | - | Término de búsqueda. Compara por folio, correo del solicitante, nombre, apellido paterno o CURP del solicitante. |

### Ejemplos de Petición con Query Params
* `GET /api/solicitudes/obtener-presolicitudes?search=PRE-923845`
* `GET /api/solicitudes/obtener-presolicitudes?estado=pendiente&sucursal_id=1&limit=20`

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Presolicitudes obtenidas con éxito",
  "data": [
    {
      "id": 12,
      "folio": "PRE-923845",
      "nombreSolicitante": "Carlos Ruiz Espinoza",
      "sucursal": "Sucursal Centro Norte",
      "validador": "carlosvalidador",
      "coordinador": "coordinador1",
      "estado": "VALIDADA",
      "correoSolicitante": "carlos.ruiz@example.com",
      "createdAt": "2026-08-06T06:22:45.000Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

## 6. Detalle Completo de Presolicitud (`GET /detalle-presolicitud/:id`)

### Descripción
Obtiene el desglose absoluto de una presolicitud por su ID único. Retorna la información completa de la persona y su dirección particular, la sucursal de vinculación, el validador y coordinador asignados, y los arreglos de vehículos, negocios y familiares registrados.

* **URL:** `/api/solicitudes/detalle-presolicitud/:id`
* **Método:** `GET`

### Parámetros de Ruta (`req.params`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | Number | **Sí** | ID único (`id`) de la Presolicitud. |

### Ejemplo de Petición
`GET /api/solicitudes/detalle-presolicitud/12`

### Respuestas

#### Respuesta Exitosa (`200 OK`)
```json
{
  "message": "Detalle de presolicitud obtenido con éxito",
  "data": {
    "id": 12,
    "folio": "PRE-923845",
    "personaId": 24,
    "sucursalId": 1,
    "validadorId": 4,
    "coordinadorId": 2,
    "estado": "VALIDADA",
    "correoSolicitante": "carlos.ruiz@example.com",
    "createdAt": "2026-08-06T06:22:45.000Z",
    "persona": {
      "id": 24,
      "nombre": "Carlos",
      "apellidoPaterno": "Ruiz",
      "apellidoMaterno": "Espinoza",
      "fechaNacimiento": "1988-11-23T00:00:00.000Z",
      "telefono": "3339876543",
      "genero": "Masculino",
      "curp": "RUEC881123HDFXNS01",
      "rfc": "RUEC881123XX3",
      "ine": "INE-CARLOS-RUIZ",
      "comprobanteDomicilio": "comprobante_carlos.pdf",
      "direccion": {
        "id": 5,
        "estado": "Jalisco",
        "municipio": "Zapopan",
        "codigoPostal": "45130",
        "colonia": "Constitución",
        "calle": "Manuel M. Diéguez",
        "numeroExterior": "124",
        "numeroInterior": null,
        "referencia": "A espaldas de la primaria"
      }
    },
    "sucursal": {
      "id": 1,
      "nombre": "Sucursal Centro Norte"
    },
    "validador": {
      "id": 4,
      "usuario": {
        "username": "carlosvalidador",
        "email": "validador@company.com"
      }
    },
    "coordinador": {
      "id": 2,
      "usuario": {
        "username": "coordinador1",
        "email": "coordinador1@company.com"
      }
    },
    "vehiculos": [
      {
        "id": 1,
        "presolicitudId": 12,
        "vehiculoId": 1,
        "vehiculo": {
          "id": 1,
          "marca": "Nissan",
          "modelo": "Versa",
          "placas": "JXY-98-34",
          "ano": "2020",
          "color": "Gris",
          "tipoVehiculo": "Sedán"
        }
      }
    ],
    "negocios": [
      {
        "id": 1,
        "presolicitudId": 12,
        "negocioId": 1,
        "carta": "carta_constancia.pdf",
        "antiguedad": "1970-01-01T20:15:09.000Z",
        "negocio": {
          "id": 1,
          "nombre": "Abarrotes Don Carlos",
          "sucursal": "Zapopan Centro",
          "telefono": "3331112222"
        }
      }
    ],
    "familiares": [
      {
        "id": 1,
        "presolicitudId": 12,
        "familiarId": 25,
        "relacion": "Madre",
        "familiar": {
          "id": 25,
          "nombre": "María Luisa",
          "apellidoPaterno": "Espinoza",
          "apellidoMaterno": "Velasco",
          "telefono": "3335556666"
        }
      }
    ]
  }
}
```

#### Respuestas de Error Comunes

* **`404 Not Found` (Presolicitud no encontrada)**
  ```json
  {
    "message": "Presolicitud no encontrada"
  }
  ```

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al obtener el detalle de la presolicitud",
    "error": "..."
  }
  ```
