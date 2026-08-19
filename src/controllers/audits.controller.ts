import { Request, Response } from 'express';
import { AuditLog } from '../models/auditLog.model';

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

        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 15;
        const skip = (pageNumber - 1) * limitNumber;

        const filter: any = {};

        if (module) {
            filter.module = String(module).toUpperCase();
        }

        if (action) {
            filter.action = String(action).toUpperCase();
        }

        if (status) {
            filter.status = String(status).toUpperCase();
        }

        if (userId) {
            filter.userId = Number(userId);
        }

        if (username) {
            filter.username = { $regex: String(username), $options: 'i' };
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(String(startDate));
            }
            if (endDate) {
                const end = new Date(String(endDate));
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search) {
            const searchRegex = { $regex: String(search), $options: 'i' };
            filter.$or = [
                { action: searchRegex },
                { module: searchRegex },
                { username: searchRegex },
                { ipAddress: searchRegex }
            ];
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
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
