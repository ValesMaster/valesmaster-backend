import { Request, Response, NextFunction } from "express";

export const requireVpn = (req: Request, res: Response, next: NextFunction) => {
    const viaVpn = req.headers['x-via-vpn'] === 'true';

    if (!viaVpn) {
        return res.status(403).json({
            message: "Esta accion solo esta disponible por VPN"
        });
    }

    next();
};
