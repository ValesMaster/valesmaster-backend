# Guía de API: Auditoría de Logs (`audits.routes.ts`)

Esta guía detalla el funcionamiento del endpoint para consultar la bitácora de logs de auditoría almacenada en MongoDB, la cual registra las actividades y mutaciones realizadas por los usuarios y el sistema en el backend.

El enrutador está definido en [audits.routes.ts](file:///c:/Proyectos/cuatri-8/desarrollo-web/ValesMaster/valesmaster-backend/src/routes/audits.routes.ts) y se expone globalmente bajo el prefijo `/api/audits`.

---

## 1. Obtener Logs de Auditoría (`GET /logs`)

### Descripción
Obtiene un listado paginado y ordenado de forma descendente (los registros más recientes primero) de los logs de auditoría. Permite realizar búsquedas generales y aplicar filtros combinados exactos o parciales.

* **URL:** `/api/audits/logs`
* **Método:** `GET`
* **Headers:** 
  * `Content-Type: application/json`

### Parámetros de Consulta (`req.query`)
Todos los parámetros son opcionales y pueden combinarse libremente:

| Campo | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `page` | String/Number | No | `'1'` | Número de la página de resultados a consultar. |
| `limit` | String/Number | No | `'15'` | Cantidad de registros a retornar por página. |
| `module` | String | No | - | Filtra de forma exacta por el módulo afectado. Se convierte a mayúsculas automáticamente (ej. `AUTH`, `SOLICITUDES`). |
| `action` | String | No | - | Filtra de forma exacta por la acción realizada (ej. `CREAR_PRESOLICITUD`, `VALIDAR_PRESOLICITUD`). |
| `status` | String | No | - | Filtra por el estado final de la acción (`SUCCESS` o `FAILED`). |
| `userId` | String/Number | No | - | Filtra por el ID numérico del usuario de la base de datos relacional (PostgreSQL) que ejecutó la acción. |
| `username` | String | No | - | Realiza una búsqueda parcial (con expresiones regulares) e insensible a mayúsculas sobre el nombre del usuario. |
| `startDate` | String (Fecha) | No | - | Fecha de inicio del rango a consultar (formato `YYYY-MM-DD` o ISO). Utiliza operador mayor o igual que (`$gte`). |
| `endDate` | String (Fecha) | No | - | Fecha de fin del rango a consultar. Se ajusta automáticamente al final del día (`23:59:59.999`) y aplica operador menor o igual que (`$lte`). |
| `search` | String | No | - | Término de búsqueda general. Compara el texto de manera parcial e insensible a mayúsculas en los campos `action`, `module`, `username` y `ipAddress`. |

### Ejemplos de Peticiones Combinadas

* **Consultar la página 2 con un límite de 20 logs:**
  `GET /api/audits/logs?page=2&limit=20`

* **Filtrar por errores (`FAILED`) del módulo de Autenticación (`AUTH`):**
  `GET /api/audits/logs?module=auth&status=failed`

* **Buscar logs de un usuario específico dentro de un rango de fechas:**
  `GET /api/audits/logs?userId=12&startDate=2026-08-01&endDate=2026-08-15`

* **Búsqueda general para logs que involucren solicitudes y hayan fallado:**
  `GET /api/audits/logs?search=solicitud&status=failed`

---

### Respuestas

#### Respuesta Exitosa (`200 OK`)
Retorna un arreglo de objetos de auditoría junto con los datos de paginación de la consulta.

```json
{
  "message": "Logs de auditoría obtenidos con éxito",
  "data": [
    {
      "_id": "690ff3ab27e365022fa98122",
      "action": "VALIDAR_PRESOLICITUD",
      "module": "SOLICITUDES",
      "userId": 4,
      "username": "carlosvalidador",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
      "status": "SUCCESS",
      "details": {
        "presolicitudId": 12,
        "nuevoEstado": "VALIDADA",
        "folio": "PRE-923845"
      },
      "createdAt": "2026-08-18T23:10:45.000Z"
    },
    {
      "_id": "690ff31237e365022fa98110",
      "action": "CREAR_PRESOLICITUD",
      "module": "SOLICITUDES",
      "userId": null,
      "username": null,
      "ipAddress": "192.168.1.50",
      "userAgent": "PostmanRuntime/7.40.0",
      "status": "FAILED",
      "details": {
        "error": "Es necesario registrar los negocios en los que el solicitante ha estado"
      },
      "createdAt": "2026-08-18T23:08:12.000Z"
    }
  ],
  "pagination": {
    "totalItems": 45,
    "totalPages": 3,
    "currentPage": 1,
    "limit": 15
  }
}
```

#### Respuestas de Error Comunes

* **`500 Internal Server Error`**
  ```json
  {
    "message": "Error al consultar logs de auditoría",
    "error": "Detalle técnico del error"
  }
  ```

---

### Ejemplo de Uso en el Frontend (Next.js / TypeScript)

A continuación se muestra un ejemplo de un componente de React en Next.js que consume este endpoint, maneja estados de filtros interactivos en un formulario y gestiona la navegación de la paginación:

```tsx
import React, { useState, useEffect } from 'react';

interface AuditLog {
  _id: string;
  action: string;
  module: string;
  userId?: number;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED';
  details?: Record<string, any>;
  createdAt: string;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export default function HistorialAuditorias() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de filtros
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    module: '',
    status: '',
    search: '',
    startDate: '',
    endDate: ''
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Construir query string dinámicamente
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`http://localhost:3000/api/audits/logs?${queryParams.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(data.data);
        setPagination(data.pagination);
      } else {
        console.error('Error al obtener auditorías:', data.message);
      }
    } catch (error) {
      console.error('Error de red:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recargar logs cuando cambian los filtros de página o búsqueda
  useEffect(() => {
    fetchLogs();
  }, [filters.page, filters.limit]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1 // Reiniciar a la página 1 cuando cambie cualquier filtro
    }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Bitácora de Auditoría del Sistema</h1>

      {/* Formulario de Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-white p-4 rounded-lg shadow border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Módulo</label>
          <select name="module" value={filters.module} onChange={handleFilterChange} className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
            <option value="">Todos los módulos</option>
            <option value="AUTH">Seguridad / Auth</option>
            <option value="SOLICITUDES">Solicitudes</option>
            <option value="VALES">Vales y Créditos</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
            <option value="">Todos</option>
            <option value="SUCCESS">Éxito (SUCCESS)</option>
            <option value="FAILED">Fallo (FAILED)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Búsqueda general</label>
          <input 
            type="text" 
            name="search" 
            placeholder="Buscar por acción, usuario o IP..." 
            value={filters.search} 
            onChange={handleFilterChange} 
            className="w-full border rounded px-3 py-2 text-sm" 
          />
        </div>

        <div className="flex items-end">
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded py-2 text-sm transition">
            Buscar
          </button>
        </div>
      </form>

      {/* Tabla de Logs */}
      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando bitácora de auditoría...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold border-b">
                <th className="p-4">Fecha / Hora</th>
                <th className="p-4">Módulo</th>
                <th className="p-4">Acción</th>
                <th className="p-4">Usuario</th>
                <th className="p-4">IP</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Detalles</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700 divide-y">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No se encontraron registros de auditoría.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="p-4 text-xs whitespace-nowrap text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 font-medium text-xs">
                      <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono">{log.action}</td>
                    <td className="p-4">
                      {log.username ? (
                        <div>
                          <p className="font-semibold text-gray-900">{log.username}</p>
                          <p className="text-xs text-gray-400">ID: {log.userId}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Invitado / Anon</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-500">{log.ipAddress || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        log.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      <details className="cursor-pointer">
                        <summary className="text-indigo-600 hover:text-indigo-800">Ver JSON</summary>
                        <pre className="mt-2 p-2 bg-gray-900 text-green-400 rounded overflow-x-auto max-w-xs text-[10px] font-mono">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500">
              Mostrando página {pagination.currentPage} de {pagination.totalPages} (Total de {pagination.totalItems} registros)
            </span>
            <div className="flex gap-2">
              <button 
                disabled={filters.page === 1} 
                onClick={() => handlePageChange(filters.page - 1)}
                className="px-3 py-1 border rounded text-xs bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
              >
                Anterior
              </button>
              <button 
                disabled={filters.page === pagination.totalPages} 
                onClick={() => handlePageChange(filters.page + 1)}
                className="px-3 py-1 border rounded text-xs bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```
