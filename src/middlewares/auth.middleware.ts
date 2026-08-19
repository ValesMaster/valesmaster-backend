import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { respondJwtError } from "../utils/jwtErrors";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                message: "Token requerido"
            });
        }

        const token = auth.split(" ")[1];

        const payload: any = jwt.verify(token, process.env.JWT_SECRET!);

        if (payload.step) {
            return res.status(401).json({
                message: "Token inválido."
            });
        }

        req.user = { id: payload.id, rol: payload.rol };

        next();
    } catch (error) {
        const jwtResponse = respondJwtError(res, error);
        if (jwtResponse) return jwtResponse;

        console.error("Error al verificar token", error);
        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
};

export const requireRole = (...rolesPermitidos: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Token requerido"
            });
        }

        if (!rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({
                message: "No tiene permisos para acceder a este recurso"
            });
        }

        next();
    };
};
