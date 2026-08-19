import { Request, Response } from "express";
import prisma from "../lib/prisma";

//#region Crear Canje
export const canjearPuntos = async (req: Request, res: Response) => {
    const { id_distribuidora, id_cajero, cantidad_canjeada } = req.body;

    try {
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
                cajeroId: id_cajero,
                distribuidoraId: id_distribuidora,
                cantidadCanjeada: cantidad_canjeada,
                cantidadEfectivo: cantidad_efectivo
            }
        });

        const distribuidoraActualizada = await prisma.distribuidora.update({
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
        return res.status(500).json({
            message: 'Error al realizar el canje de puntos'
        });
    }
}

// ? TO DO: Metodos para CRUD de canjes 

//#region Obtener 

//#region Obtener Canjes
export const obtenerCanjes = async (req: Request, res: Response) => {

}