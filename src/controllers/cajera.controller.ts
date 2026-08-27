import { Request, Response } from "express";
import prisma, { prismaRead } from "../lib/prisma";
import { registerAudit } from "../services/audit.service";

//#region Crear Canje
export const canjearPuntos = async (req: Request, res: Response) => {
    const { id_distribuidora, cantidad_canjeada } = req.body;

    try {
        const cajera = await prisma.empleado.findFirst({
            where: { usuarioId: req.user?.id },
            include: { usuario: true }
        });

        if (!cajera) {
            return res.status(404).json({
                message: 'No hay ningun empleado asociado al usuario'
            })
        }

        const distribuidora = await prisma.distribuidora.findUnique({
            where: { id: id_distribuidora }
        });

        if (!distribuidora) {
            return res.status(404).json({
                message: 'Distribuidora no encontrada'
            });
        }

        if (distribuidora.puntos && distribuidora.puntos.toNumber() < cantidad_canjeada) {
            return res.status(400).json({
                message: 'Puntos insuficientes'
            });
        }

        const cantidad_efectivo = cantidad_canjeada * 2;

        const nuevoCanje = await prisma.canjePuntos.create({
            data: {
                cajeroId: Number(cajera.id),
                distribuidoraId: id_distribuidora,
                cantidadCanjeada: cantidad_canjeada,
                cantidadEfectivo: cantidad_efectivo
            }
        });

        registerAudit({
            action: 'CANJE_PUNTOS',
            module: 'CAJERA',
            status: 'SUCCESS',
            req,
            details: {
                canje_id: Number(nuevoCanje.id),
                username: cajera.usuario.username,
                email: cajera.usuario.email
            }
        });

        await prisma.distribuidora.update({
            where: { id: distribuidora.id },
            data: {
                puntos: Number(distribuidora.puntos) - cantidad_canjeada
            }
        });

        return res.status(200).json({
            message: `Canje de puntos exitoso, pague la cantidad de $${cantidad_efectivo} a la distribuidora`,
            data: nuevoCanje
        });
    } catch (error: any) {
        registerAudit({
            action: 'CANJE_PUNTOS',
            module: 'CAJERA',
            status: 'FAILED',
            req,
            details: {
                distribuidoraId: id_distribuidora,
                cantidad_canjeada,
                error: error.message
            }
        });

        return res.status(500).json({
            message: 'Error al realizar el canje de puntos'
        });
    }
}

//#region Obtener Canjes
export const obtenerCanjes = async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '10', distribuidora_id } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const cajera = await prismaRead.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!cajera) {
            return res.status(404).json({
                message: 'No hay ningun empleado asociado al usuario'
            });
        }

        const whereClause: any = { cajeroId: cajera.id };

        if (distribuidora_id) {
            whereClause.distribuidoraId = Number(distribuidora_id);
        }

        const [canjes, total] = await Promise.all([
            prismaRead.canjePuntos.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    distribuidora: {
                        include: {
                            usuario: { select: { username: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.canjePuntos.count({ where: whereClause })
        ]);

        return res.status(200).json({
            message: 'Canjes obtenidos con exito',
            data: canjes,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al obtener los canjes'
        })
    }
}

// #region Obtener Distribuidoras
export const obtenerDistribuidoras = async (req: Request, res: Response) => {
    try {
        const empleadoCajero = await prismaRead.empleado.findFirst({
            where: { usuarioId: Number(req.user!.id) }
        })

        if (!empleadoCajero) {
            res.status(404).json({
                message: 'No se encontro ningun empleado relacionado al usuario en sesion'
            });
        }

        const distribuidoras = await prismaRead.distribuidora.findMany({
            where: { sucursalId: Number(empleadoCajero?.sucursalId) },
            include: { usuario: true }
        });

        if (!distribuidoras) {
            return res.status(404).json({
                message: 'No se encontraron distribuidoras en esta sucursal'
            })
        }

        return res.status(200).json({
            message: 'Distribuidoras obtenidas exitosamente',
            data: distribuidoras
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al obtener distribuidoras'
        })
    }
}