# Guía de API: Solicitudes y Presolicitudes (`solicitudes.routes.ts`)

Esta guía detalla los endpoints relacionados con el ciclo de vida de las solicitudes de crédito para distribuidoras definidos en [solicitudes.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/solicitudes.routes.ts). El flujo general de este apartado consta de tres etapas principales:

1. **Creación de Presolicitud**: Datos generales del solicitante con referencias de vehículos, negocios y familiares.
2. **Validación de Presolicitud**: Revisión por parte de un empleado "Validador" para cambiar el estado a `VALIDADA` o `RECHAZADA` (si se valida, se crea automáticamente una Solicitud).
3. **Aprobación de Solicitud**: Aprobación final por parte de un "Gerente" que promueve al solicitante a "Distribuidora" activa con línea de crédito y accesos al sistema.

---

## 1. Crear Presolicitud (`POST /crear`)

### Descripción
Crea una nueva presolicitud registrando en bloque la información de la Persona, su Dirección, y sus relaciones complejas de vehículos, negocios y familiares directos. También maneja la subida de los 4 documentos del solicitante.

* **URL:** `/api/solicitudes/crear`
* **Método:** `POST`
* **Headers:** 
  * `Content-Type: multipart/form-data`

### Cuerpo de la Petición (`FormData`)
Debido a que este endpoint soporta la subida de archivos físicos, el cuerpo de la petición debe enviarse utilizando la interfaz `FormData` en el cliente. Los campos se distribuyen de la siguiente manera:

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| **Datos de Persona (Texto)** | | | |
| `nombre` | String | **Sí** | Nombre(s) del solicitante. |
| `apellido_paterno`| String | **Sí** | Apellido paterno. |
| `apellido_materno`| String | No | Apellido materno. |
| `fecha_nacimiento`| String | **Sí** | Fecha de nacimiento (ej. `YYYY-MM-DD`). |
| `telefono` | String | **Sí** | Teléfono de contacto. |
| `genero` | String | **Sí** | Género (ej. `Femenino`, `Masculino`). |
| **Documentos (Archivos)** | | | |
| `ine` | Archivo (File) | No | Identificación INE o pasaporte (PDF, PNG o JPEG. Máx. 5MB). |
| `rfc` | Archivo (File) | No | Cédula de identificación fiscal RFC (PDF, PNG o JPEG. Máx. 5MB). |
| `curp` | Archivo (File) | No | Clave Única de Registro de Población (PDF, PNG o JPEG. Máx. 5MB). |
| `comprobante_domicilio` | Archivo (File) | No | Comprobante de domicilio (PDF, PNG o JPEG. Máx. 5MB). |
| **Datos de Dirección (Texto)** | | | |
| `estado` | String | **Sí** | Estado. |
| `municipio` | String | **Sí** | Municipio o alcaldía. |
| `codigo_postal`| String | **Sí** | Código Postal. |
| `colonia` | String | **Sí** | Colonia. |
| `calle` | String | **Sí** | Calle. |
| `numero_exterior`| String | **Sí** | Número exterior. |
| `numero_interior`| String | No | Número interior. |
| `referencia` | String | No | Referencias físicas del domicilio. |
| **Datos de Presolicitud (Texto)** | | | |
| `sucursal_id` | Number/String | **Sí** | ID de la sucursal de vinculación. |
| `coordinador_id`| Number/String | No | ID del empleado coordinador asignado. |
| `correo_solicitante`| String| **Sí** | Correo electrónico de contacto de la futura distribuidora. |
| **Colecciones (JSON Strings)** | | | |
| `vehiculos` | String (JSON) | No | Colección de vehículos del solicitante (ver estructura abajo). Debe ser un string en formato JSON (`JSON.stringify`). |
| `negocios` | String (JSON) | **Sí** | Colección de negocios del solicitante (mínimo 1 requerido). Debe ser un string en formato JSON (`JSON.stringify`). |
| `familiares` | String (JSON) | **Sí** | Colección de familiares directos (mínimo 1 requerido). Debe ser un string en formato JSON (`JSON.stringify`). |

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

### Ejemplo de Uso en el Frontend (Next.js / TypeScript)

A continuación se muestra cómo estructurar el componente y la lógica de envío en Next.js utilizando `FormData` para adjuntar los campos de texto, las colecciones serializadas en JSON y los 4 archivos correspondientes:

```tsx
import React, { useState } from 'react';

interface Vehiculo {
  marca: string;
  modelo: string;
  placas: string;
  ano: string;
  color: string;
  tipoVehiculo: string;
}

interface Negocio {
  nombre: string;
  sucursal: string;
  telefono: string;
  carta: string;
  antiguedad: string;
}

interface Familiar {
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  telefono: string;
  relacion: string;
}

export default function CrearPresolicitudForm() {
  // Estado para campos de texto simples
  const [formData, setFormData] = useState({
    nombre: 'Carlos',
    apellido_paterno: 'Ruiz',
    apellido_materno: 'Espinoza',
    fecha_nacimiento: '1988-11-23',
    telefono: '3339876543',
    genero: 'Masculino',
    estado: 'Jalisco',
    municipio: 'Zapopan',
    codigo_postal: '45130',
    colonia: 'Constitución',
    calle: 'Manuel M. Diéguez',
    numero_exterior: '124',
    numero_interior: '',
    referencia: 'A espaldas de la primaria',
    sucursal_id: '1',
    coordinador_id: '2',
    correo_solicitante: 'carlos.ruiz@example.com'
  });

  // Estado para archivos
  const [ineFile, setIneFile] = useState<File | null>(null);
  const [rfcFile, setRfcFile] = useState<File | null>(null);
  const [curpFile, setCurpFile] = useState<File | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  // Colecciones estructuradas
  const vehiculos: Vehiculo[] = [
    {
      marca: 'Nissan',
      modelo: 'Versa',
      placas: 'JXY-98-34',
      ano: '2020',
      color: 'Gris',
      tipoVehiculo: 'Sedán'
    }
  ];

  const negocios: Negocio[] = [
    {
      nombre: 'Abarrotes Don Carlos',
      sucursal: 'Zapopan Centro',
      telefono: '3331112222',
      carta: 'carta_constancia.pdf',
      antiguedad: '2015-09-01'
    }
  ];

  const familiares: Familiar[] = [
    {
      nombre: 'María Luisa',
      apellido_paterno: 'Espinoza',
      apellido_materno: 'Velasco',
      telefono: '3335556666',
      relacion: 'Madre'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();

    // 1. Agregar campos de texto individuales
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });

    // 2. Agregar los archivos físicos
    if (ineFile) data.append('ine', ineFile);
    if (rfcFile) data.append('rfc', rfcFile);
    if (curpFile) data.append('curp', curpFile);
    if (comprobanteFile) data.append('comprobante_domicilio', comprobanteFile);

    // 3. Serializar colecciones complejas como JSON strings
    data.append('vehiculos', JSON.stringify(vehiculos));
    data.append('negocios', JSON.stringify(negocios));
    data.append('familiares', JSON.stringify(familiares));

    try {
      const response = await fetch('http://localhost:3000/api/solicitudes/crear', {
        method: 'POST',
        // IMPORTANTE: Al enviar FormData, NO se debe definir la cabecera 'Content-Type' manualmente.
        // El navegador detectará FormData e inyectará 'multipart/form-data' junto con la clave boundary.
        body: data,
      });

      const resJson = await response.json();

      if (response.ok) {
        alert(`Presolicitud creada con éxito. Folio: ${resJson.data.folio}`);
      } else {
        alert(`Error: ${resJson.message}`);
      }
    } catch (error) {
      console.error('Error al realizar la petición:', error);
      alert('Error en la conexión con el servidor.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Ejemplo simple de inputs para archivos */}
      <div>
        <label>Identificación (INE/Pasaporte):</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setIneFile(e.target.files?.[0] || null)} />
      </div>
      <div>
        <label>Cédula de RFC:</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setRfcFile(e.target.files?.[0] || null)} />
      </div>
      <div>
        <label>CURP:</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setCurpFile(e.target.files?.[0] || null)} />
      </div>
      <div>
        <label>Comprobante de Domicilio:</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)} />
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
        Enviar Presolicitud
      </button>
    </form>
  );
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

---

## 7. Obtener Archivo (`GET /archivos/:nombreArchivo`)

### Descripción
Permite consultar, visualizar o descargar los archivos adjuntos (INE, RFC, CURP, Comprobante de Domicilio) que fueron previamente subidos y asociados a las personas en el proceso de presolicitud.

* **URL:** `/api/solicitudes/archivos/:nombreArchivo`
* **Método:** `GET`

### Parámetros de Ruta (`req.params`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `nombreArchivo` | String | **Sí** | El nombre completo y único del archivo que está almacenado en la base de datos (por ejemplo, `1723924265000-848392019-ine.pdf`). |

### Respuestas

#### Respuesta Exitosa (`200 OK`)
Devuelve el flujo binario del archivo original con su respectiva cabecera `Content-Type` configurada automáticamente de acuerdo al tipo MIME registrado (`image/jpeg`, `image/png`, `application/pdf`).

#### Respuestas de Error Comunes

* **`400 Bad Request` (Parámetros inválidos)**
  ```json
  {
    "message": "Nombre de archivo invalido"
  }
  ```

* **`404 Not Found` (Archivo inexistente)**
  ```json
  {
    "message": "Archivo no encontrado en el storage ni en respaldo"
  }
  ```

---

### Integración y Visualización en el Frontend (Next.js / TypeScript)

En un entorno frontend moderno como Next.js, descargar o visualizar archivos binarios que requieren algún tipo de cabeceras o manejo seguro es sencillo. A continuación se presentan las dos opciones de visualización más comunes:

#### Opción 1: Visualización Segura mediante fetch como Blob (Recomendado para endpoints protegidos)
Si tu API requiere cabeceras de autorización (por ejemplo, un token JWT con `Authorization: Bearer <token>`), no puedes usar simplemente una etiqueta `<img src="..." />` o un `<iframe>`. Debes realizar la petición usando `fetch`, transformar la respuesta a un objeto `Blob` y crear una URL temporal.

Aquí tienes un componente reutilizable de React en Next.js para visualizar PDFs o Imágenes de forma segura:

```tsx
import React, { useEffect, useState } from 'react';

interface FileViewerProps {
  fileName: string;
  authToken?: string; // Token de autenticación si se requiere
}

export default function FileViewer({ fileName, authToken }: FileViewerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`http://localhost:3000/api/solicitudes/archivos/${fileName}`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error('No se pudo obtener el archivo solicitado.');
        }

        // Detectar tipo MIME
        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('application/pdf')) {
          setFileType('pdf');
        } else if (contentType?.includes('image/')) {
          setFileType('image');
        } else {
          setFileType(null); // Tipo no soportado para visualización directa
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Ocurrió un error al cargar el archivo.');
      } finally {
        setLoading(false);
      }
    };

    if (fileName) {
      fetchFile();
    }

    // Limpieza de memoria al desmontar el componente
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileName, authToken]);

  if (loading) return <div className="text-gray-500 text-sm">Cargando archivo...</div>;
  if (error) return <div className="text-red-500 text-sm">Error: {error}</div>;
  if (!fileUrl) return <div className="text-gray-400 text-sm">Archivo no disponible</div>;

  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="font-semibold text-sm truncate max-w-xs">{fileName}</span>
        <a 
          href={fileUrl} 
          download={fileName} 
          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition"
        >
          Descargar Archivo
        </a>
      </div>

      <div className="w-full h-[500px] flex items-center justify-center bg-white rounded overflow-hidden">
        {fileType === 'pdf' ? (
          <iframe 
            src={fileUrl} 
            className="w-full h-full border-none" 
            title="Visualizador de PDF"
          />
        ) : fileType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={fileUrl} 
            alt="Archivo visualizado" 
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center p-4">
            <p className="text-gray-500 mb-2">Este archivo no se puede visualizar directamente en el navegador.</p>
            <p className="text-xs text-gray-400">Usa el botón superior para descargarlo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Opción 2: Enlace de Referencia Directa (Para endpoints públicos / sin token de cabecera)
Si tu backend no requiere cabeceras HTTP especiales en el endpoint de visualización de archivos, o si la sesión se gestiona automáticamente por medio de Cookies (HTTPOnly), puedes enlazar directamente las URLs:

* **Para Imágenes:**
  ```tsx
  <img 
    src={`http://localhost:3000/api/solicitudes/archivos/${fileName}`} 
    alt="Identificación Oficial" 
    className="w-full object-cover"
  />
  ```

* **Para Documentos PDF:**
  ```tsx
  <iframe 
    src={`http://localhost:3000/api/solicitudes/archivos/${fileName}`} 
    className="w-full h-[600px] border-none"
  />
  ```
