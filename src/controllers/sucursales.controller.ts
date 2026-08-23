import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { registerAudit } from "../services/audit.service";

const CODIGO_POSTAL_REGEX = /^\d{5}$/;

//#region Obtener Sucursales
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

//#region Crear Sucursal
// Crear sucursal
export const createSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      nombre,
      estado,
      municipio,
      codigo_postal,
      colonia,
      calle,
      numero_exterior,
      numero_interior,
      referencia,
    } = req.body;

    // Validar datos obligatorios
    if (
      !nombre ||
      !estado ||
      !municipio ||
      !codigo_postal ||
      !colonia ||
      !calle ||
      !numero_exterior
    ) {
      res.status(400).json({
        success: false,
        message:
          "Los campos nombre, estado, municipio, codigo_postal, colonia, calle y numero_exterior son obligatorios",
      });
      return;
    }

    if (!CODIGO_POSTAL_REGEX.test(String(codigo_postal))) {
      res.status(400).json({
        success: false,
        message: "El codigo_postal debe tener 5 digitos",
      });
      return;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // Crear dirección
      const nuevaDireccion = await tx.direccion.create({
        data: {
          estado,
          municipio,
          codigoPostal: codigo_postal,
          colonia,
          calle,
          numeroExterior: numero_exterior,
          numeroInterior: numero_interior ?? null,
          referencia: referencia ?? null,
        },
      });

      // Crear sucursal utilizando la dirección recién creada
      const nuevaSucursal = await tx.sucursal.create({
        data: {
          nombre,
          direccionId: nuevaDireccion.id,
        },
        include: {
          direccion: true,
        },
      });

      return nuevaSucursal;
    });

        // Registrar auditoría de éxito
    registerAudit({
      action: "CREAR_SUCURSAL",
      module: "SUCURSALES",
      status: "SUCCESS",
      req,
      details: {
        sucursalId: resultado.id,
        nombre: resultado.nombre,
        direccionId: resultado.direccionId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Sucursal y dirección creadas correctamente",
      data: resultado,
    });
  } catch (error: any) {
    console.error("Error al crear sucursal:", error);

    registerAudit({
        action: "CREAR_SUCURSAL",
        module: "SUCURSALES",
        status: "FAILED",
        req,
        details: {
            nombre: req.body?.nombre,
            error: error.message,
        },
    });

    res.status(500).json({
      success: false,
      message: "Error al crear la sucursal y su dirección",
    });
  }
};

//#region Modificar Sucursal
// Modificar sucursal
export const updateSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  try {
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: "El ID de la sucursal no es válido",
      });
      return;
    }

    const {
      nombre,
      estado,
      municipio,
      codigo_postal,
      colonia,
      calle,
      numero_exterior,
      numero_interior,
      referencia,
    } = req.body;

    if (nombre !== undefined && String(nombre).trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "El nombre no puede estar vacio",
      });
      return;
    }

    if (codigo_postal !== undefined && !CODIGO_POSTAL_REGEX.test(String(codigo_postal))) {
      res.status(400).json({
        success: false,
        message: "El codigo_postal debe tener 5 digitos",
      });
      return;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const sucursal = await tx.sucursal.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          direccion: true,
        },
      });

      if (!sucursal) {
        throw new Error("Sucursal no encontrada");
      }

      const sucursalActualizada = await tx.sucursal.update({
        where: {
          id,
        },
        data: {
          ...(nombre !== undefined && {
            nombre,
          }),
        },
        include: {
          direccion: true,
        },
      });

      const direccionActualizada = await tx.direccion.update({
        where: {
          id: sucursal.direccionId,
        },
        data: {
          ...(estado !== undefined && {
            estado,
          }),
          ...(municipio !== undefined && {
            municipio,
          }),
          ...(codigo_postal !== undefined && {
            codigoPostal: codigo_postal,
          }),
          ...(colonia !== undefined && {
            colonia,
          }),
          ...(calle !== undefined && {
            calle,
          }),
          ...(numero_exterior !== undefined && {
            numeroExterior: numero_exterior,
          }),
          ...(numero_interior !== undefined && {
            numeroInterior: numero_interior,
          }),
          ...(referencia !== undefined && {
            referencia,
          }),
        },
      });

      return {
        sucursal: sucursalActualizada,
        direccion: direccionActualizada,
      };
    });

    // Registrar auditoría de éxito
    registerAudit({
      action: "MODIFICAR_SUCURSAL",
      module: "SUCURSALES",
      status: "SUCCESS",
      req,
      details: {
        sucursalId: id,
        nombre: resultado.sucursal.nombre,
        direccionId: resultado.sucursal.direccionId,
        cambios: req.body,
      },
    });

    res.status(200).json({
      success: true,
      message: "Sucursal actualizada correctamente",
      data: resultado,
    });
  } catch (error: any) {
    console.error("Error al actualizar sucursal:", error);

    // Registrar auditoría de fallo
    registerAudit({
      action: "MODIFICAR_SUCURSAL",
      module: "SUCURSALES",
      status: "FAILED",
      req,
      details: {
        sucursalId: id,
        cambios: req.body,
        error: error.message,
      },
    });

    if (error.message === "Sucursal no encontrada") {
      res.status(404).json({
        success: false,
        message: "Sucursal no encontrada",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Error al actualizar la sucursal",
    });
  }
};

//#region Soft Delete Sucursal
// Soft delete
export const deleteSucursal = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  try {
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

    const [empleadosActivos, distribuidorasActivas] = await Promise.all([
      prisma.empleado.count({ where: { sucursalId: id, deletedAt: null } }),
      prisma.distribuidora.count({ where: { sucursalId: id, deletedAt: null } }),
    ]);

    if (empleadosActivos > 0 || distribuidorasActivas > 0) {
      res.status(400).json({
        success: false,
        message:
          "No se puede eliminar la sucursal porque todavia tiene empleados o distribuidoras activos asignados",
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
      include: {
        direccion: true,
      },
    });

    // Registrar auditoría de éxito
    registerAudit({
      action: "ELIMINAR_SUCURSAL",
      module: "SUCURSALES",
      status: "SUCCESS",
      req,
      details: {
        sucursalId: sucursalEliminada.id,
        nombre: sucursalEliminada.nombre,
        direccionId: sucursalEliminada.direccionId,
        deletedAt: sucursalEliminada.deletedAt,
      },
    });

    res.status(200).json({
      success: true,
      message: "Sucursal eliminada correctamente",
      data: sucursalEliminada,
    });
  } catch (error: any) {
    console.error("Error al eliminar sucursal:", error);

    // Registrar auditoría de fallo
    registerAudit({
      action: "ELIMINAR_SUCURSAL",
      module: "SUCURSALES",
      status: "FAILED",
      req,
      details: {
        sucursalId: id,
        error: error.message,
      },
    });

    res.status(500).json({
      success: false,
      message: "Error al eliminar la sucursal",
    });
  }
};