import { Request } from "express";
import { AuditLog } from "../models/auditLog.model";

interface AuditParams {
    action: string;
    module: string;
    status: 'SUCCESS' | 'FAILED';
    details?: Record<string, any>;
    req?: Request;
}

export const registerAudit = async ({
    action,
    module,
    status,
    details = {},
    req
}: AuditParams): Promise<void> => {
    try {
        let userId: number | undefined;
        let username: string | undefined;
        let ipAddress: string | undefined;
        let userAgent: string | undefined;

        if (req) {
            ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
            userAgent = req.headers['user-agent'];

            if ((req as any).user) {
                userId = (req as any).user.id;
                username = (req as any).user.username;
            }
        }

        await AuditLog.create({
            action,
            module,
            userId,
            username,
            ipAddress,
            userAgent,
            status,
            details
        });
    } catch (error) {
        console.error('Error al registrar auditoria:', error)
    }
}