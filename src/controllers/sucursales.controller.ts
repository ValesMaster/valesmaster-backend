import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Obtener todas las sucursales
export const getSucursales = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const sucursales = await prisma.sucursal.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        direccion: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json({
      success: true,
      data: sucursales,
    });
  } catch (error) {
    console.error("Error al obtener sucursales:", error);

    res.status(500).json({
      success: false,
      message: "Error al obtener las sucursales",
    });
  }
};


// Obtener una sucursal por ID
export const getSucursalById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: "El ID de la sucursal no es válido",
      });
      return;
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        direccion: true,
      },
    });

    if (!sucursal) {
      res.status(404).json({
        success: false,
        message: "Sucursal no encontrada",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: sucursal,
    });
  } catch (error) {
    console.error("Error al obtener la sucursal:", error);

    res.status(500).json({
      success: false,
      message: "Error al obtener la sucursal",
    });
  }
};


// Crear sucursal
export const createSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { nombre, direccionId } = req.body;

    if (!nombre || !direccionId) {
      res.status(400).json({
        success: false,
        message: "El nombre y direccionId son obligatorios",
      });
      return;
    }

    const direccion = await prisma.direccion.findFirst({
      where: {
        id: Number(direccionId),
        deletedAt: null,
      },
    });

    if (!direccion) {
      res.status(404).json({
        success: false,
        message: "La dirección no existe",
      });
      return;
    }

    const sucursal = await prisma.sucursal.create({
      data: {
        nombre,
        direccionId: Number(direccionId),
      },
      include: {
        direccion: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Sucursal creada correctamente",
      data: sucursal,
    });
  } catch (error) {
    console.error("Error al crear sucursal:", error);

    res.status(500).json({
      success: false,
      message: "Error al crear la sucursal",
    });
  }
};


// Modificar sucursal
export const updateSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { nombre, direccionId } = req.body;

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: "El ID de la sucursal no es válido",
      });
      return;
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!sucursal) {
      res.status(404).json({
        success: false,
        message: "Sucursal no encontrada",
      });
      return;
    }

    if (direccionId !== undefined) {
      const direccion = await prisma.direccion.findFirst({
        where: {
          id: Number(direccionId),
          deletedAt: null,
        },
      });

      if (!direccion) {
        res.status(404).json({
          success: false,
          message: "La dirección no existe",
        });
        return;
      }
    }

    const sucursalActualizada = await prisma.sucursal.update({
      where: {
        id,
      },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(direccionId !== undefined && {
          direccionId: Number(direccionId),
        }),
      },
      include: {
        direccion: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Sucursal actualizada correctamente",
      data: sucursalActualizada,
    });
  } catch (error) {
    console.error("Error al actualizar sucursal:", error);

    res.status(500).json({
      success: false,
      message: "Error al actualizar la sucursal",
    });
  }
};


// Soft delete
export const deleteSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: "El ID de la sucursal no es válido",
      });
      return;
    }

    const sucursal = await prisma.sucursal.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!sucursal) {
      res.status(404).json({
        success: false,
        message: "Sucursal no encontrada",
      });
      return;
    }

    const sucursalEliminada = await prisma.sucursal.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Sucursal eliminada correctamente",
      data: sucursalEliminada,
    });
  } catch (error) {
    console.error("Error al eliminar sucursal:", error);

    res.status(500).json({
      success: false,
      message: "Error al eliminar la sucursal",
    });
  }
};