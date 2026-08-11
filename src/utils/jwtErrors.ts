import { Response } from "express";
import jwt from "jsonwebtoken";

export const respondJwtError = (res: Response, error: unknown): Response | null => {
    if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
            message: "El token expiró. Inicie el proceso nuevamente."
        });
    }

    if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
            message: "Token inválido."
        });
    }

    return null;
};
