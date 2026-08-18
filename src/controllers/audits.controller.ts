import { Request, Response } from 'express';
import { AuditLog } from '../models/auditLog.model';

/**
 * Obtiene el listado de logs de auditoría almacenados en MongoDB.
 * Soporta paginación y filtros combinables por query parameters.
 */
export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const {
            page = '1',
            limit = '15',
            module,
            action,
            status,
            userId,
            username,
            startDate,
            endDate,
            search
        } = req.query;

        // Parsear valores de paginación
        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 15;
        const skip = (pageNumber - 1) * limitNumber;

        // Construir objeto de filtros dinámicos para Mongoose
        const filter: any = {};

        // Filtro exacto por módulo (ej: SOLICITUDES, AUTH)
        if (module) {
            filter.module = String(module).toUpperCase();
        }

        // Filtro exacto por acción (ej: CREAR_PRESOLICITUD)
        if (action) {
            filter.action = String(action).toUpperCase();
        }

        // Filtro exacto por estado (SUCCESS o FAILED)
        if (status) {
            filter.status = String(status).toUpperCase();
        }

        // Filtro numérico por ID de usuario
        if (userId) {
            filter.userId = Number(userId);
        }

        // Búsqueda parcial e insensible a mayúsculas/minúsculas para el username
        if (username) {
            filter.username = { $regex: String(username), $options: 'i' };
        }

        // Filtro de rango de fechas (createdAt)
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(String(startDate));
            }
            if (endDate) {
                // Ajustar al fin de día (23:59:59.999) para abarcar todo el rango seleccionado
                const end = new Date(String(endDate));
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        // Búsqueda de texto general en múltiples campos a la vez
        if (search) {
            const searchRegex = { $regex: String(search), $options: 'i' };
            filter.$or = [
                { action: searchRegex },
                { module: searchRegex },
                { username: searchRegex },
                { ipAddress: searchRegex }
            ];
        }

        // Ejecutar las promesas en paralelo para optimizar rendimiento
        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 }) // Orden descendente (más nuevos primero)
                .skip(skip)
                .limit(limitNumber)
                .exec(),
            AuditLog.countDocuments(filter).exec()
        ]);

        return res.status(200).json({
            message: 'Logs de auditoría obtenidos con éxito',
            data: logs,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });

    } catch (error: any) {
        console.error('Error al consultar logs de auditoría:', error);
        return res.status(500).json({
            message: 'Error al consultar logs de auditoría',
            error: error.message
        });
    }
};
