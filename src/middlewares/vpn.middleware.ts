import { Request, Response, NextFunction } from "express";

export const requireVpn = (req: Request, res: Response, next: NextFunction) => {
    const viaVpn = req.headers['x-via-vpn'] === 'true';

    // TEMPORAL: para diagnosticar por que el header no esta llegando como se
    // espera. Quitar este log en cuanto se resuelva.
    console.log('[requireVpn]', {
        path: req.originalUrl,
        'x-via-vpn': req.headers['x-via-vpn'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        ip: req.ip
    });

    if (!viaVpn) {
        return res.status(403).json({
            message: "Esta accion solo esta disponible por VPN"
        });
    }

    next();
};
