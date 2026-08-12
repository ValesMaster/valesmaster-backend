import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const obtenerPerfil = async (req: Request, res: Response) => {
    const { id } = req.body;
    try {
        const distribuidora = await prisma.distribuidora.findUnique({
            where: { id: id },
            include: {
                usuario: {
                    include: { persona: true }
                }
            }
        });

        if (!distribuidora) {
            return res.status(401).json({
                message: 'No se encontro el perfil'
            });
        }

    } catch (error: any) {
        return res.status(500).json({
            message: 'Error obteniendo perfil'
        })
    }
}

export const obtenerClientes = async (req: Request, res: Response) => {
    const { id_distribuidora } = req.body;
    try {
        const clientes = await prisma.cliente.findMany({
            where: { distribuidoraId: id_distribuidora },
            include: { persona: true }
        });

        if (!clientes) {
            return res.status(401).json({
                message: 'No tiene clientes registrados',
            });
        }

        return res.status(200).json({
            message: 'Clientes obtenidos con exito',
            data: clientes
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error al obtener clientes',
            error: error.status
        })
    }
}