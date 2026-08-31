import { Request, Response } from "express";
import prisma, { prismaRead } from "../lib/prisma";
import { registerAudit } from "../services/audit.service";
import { parseId, parsePagination } from "../utils/validation";

const ESTADOS_PERMITIDOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

//#region Aplicadores por entidad
// Cada aplicador sabe como convertir el JSON "cambios" de una SolicitudCambio
// en updates reales sobre la entidad correspondiente. Para agregar una
// entidad nueva a este flujo, solo hay que sumar su aplicador aqui.
const aplicarCambioCliente = async (
    tx: any,
    entidadId: number,
    tipoAccion: string,
    cambios: Record<string, any>
) => {
    const clienteExistente = await tx.cliente.findUnique({
        where: { id: entidadId },
        include: { persona: { include: { direccion: true } } }
    });

    if (!clienteExistente) {
        throw new Error('El cliente al que aplica esta solicitud ya no existe');
    }

    if (tipoAccion === 'ELIMINAR') {
        return tx.cliente.update({
            where: { id: entidadId },
            data: { estado: 'INACTIVO', updatedAt: new Date(), deletedAt: new Date() }
        });
    }

    const direccionData: any = {};
    if (cambios.estado !== undefined) direccionData.estado = cambios.estado;
    if (cambios.municipio !== undefined) direccionData.municipio = cambios.municipio;
    if (cambios.codigo_postal !== undefined) direccionData.codigoPostal = cambios.codigo_postal;
    if (cambios.colonia !== undefined) direccionData.colonia = cambios.colonia;
    if (cambios.calle !== undefined) direccionData.calle = cambios.calle;
    if (cambios.numero_exterior !== undefined) direccionData.numeroExterior = cambios.numero_exterior;
    if (cambios.numero_interior !== undefined) direccionData.numeroInterior = cambios.numero_interior;
    if (cambios.referencia !== undefined) direccionData.referencia = cambios.referencia;

    if (Object.keys(direccionData).length > 0 && clienteExistente.persona?.direccionId) {
        await tx.direccion.update({
            where: { id: clienteExistente.persona.direccionId },
            data: direccionData
        });
    }

    const personaData: any = {};
    if (cambios.nombre !== undefined) personaData.nombre = cambios.nombre;
    if (cambios.apellido_paterno !== undefined) personaData.apellidoPaterno = cambios.apellido_paterno;
    if (cambios.apellido_materno !== undefined) personaData.apellidoMaterno = cambios.apellido_materno;
    if (cambios.fecha_nacimiento !== undefined) personaData.fechaNacimiento = new Date(cambios.fecha_nacimiento);
    if (cambios.telefono !== undefined) personaData.telefono = cambios.telefono;
    if (cambios.genero !== undefined) personaData.genero = cambios.genero;

    if (Object.keys(personaData).length > 0 && clienteExistente.personaId) {
        await tx.persona.update({
            where: { id: clienteExistente.personaId },
            data: personaData
        });
    }

    return tx.cliente.findUnique({
        where: { id: entidadId },
        include: { persona: { include: { direccion: true } } }
    });
};

const APLICADORES: Record<
    string,
    (tx: any, entidadId: number, tipoAccion: string, cambios: Record<string, any>) => Promise<any>
> = {
    CLIENTE: aplicarCambioCliente
};
//#endregion

//#region Obtener Cambios
export const obtenerCambios = async (req: Request, res: Response) => {
    try {
        const { page, limit, estado, entidad } = req.query;
        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const estadoNormalizado = estado ? String(estado).toUpperCase() : 'PENDIENTE';

        const whereClause: any = {
            estado: ESTADOS_PERMITIDOS.includes(estadoNormalizado) ? estadoNormalizado : 'PENDIENTE'
        };

        if (entidad) {
            whereClause.entidad = String(entidad).toUpperCase();
        }

        const [solicitudes, total] = await Promise.all([
            prismaRead.solicitudCambio.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    solicitante: {
                        select: { username: true, email: true, rol: { select: { nombre: true } } }
                    },
                    coordinador: {
                        include: { usuario: { select: { username: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.solicitudCambio.count({ where: whereClause })
        ]);

        return res.status(200).json({
            message: 'Solicitudes de cambio obtenidas con exito',
            data: solicitudes,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error('Error al obtener las solicitudes de cambio: ', error);
        return res.status(500).json({
            message: 'Error al obtener las solicitudes de cambio'
        });
    }
}
//#endregion

//#region Aprobar Cambio
export const aprobarCambio = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idSolicitud = parseId(id);

        if (!idSolicitud) {
            return res.status(400).json({
                message: 'El ID de la solicitud no es valido'
            });
        }

        const empleadoCoordinador = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoCoordinador) {
            return res.status(404).json({
                message: 'No se encontro un empleado asociado al usuario en sesion'
            });
        }

        const solicitud = await prisma.solicitudCambio.findUnique({
            where: { id: idSolicitud }
        });

        if (!solicitud) {
            return res.status(404).json({
                message: 'Solicitud de cambio no encontrada'
            });
        }

        if (solicitud.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: 'Esta solicitud ya fue procesada',
                error: `Estado actual: ${solicitud.estado}`
            });
        }

        const aplicador = APLICADORES[solicitud.entidad];

        if (!aplicador) {
            return res.status(400).json({
                message: `No hay un aplicador configurado para la entidad '${solicitud.entidad}'`
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const registroActualizado = await aplicador(
                tx,
                solicitud.entidadId,
                solicitud.tipoAccion,
                solicitud.cambios as Record<string, any>
            );

            const solicitudActualizada = await tx.solicitudCambio.update({
                where: { id: solicitud.id },
                data: { estado: 'APROBADA', coordinadorId: empleadoCoordinador.id }
            });

            return { registroActualizado, solicitudActualizada };
        });

        registerAudit({
            action: 'APROBAR_CAMBIO',
            module: 'CAMBIOS',
            status: 'SUCCESS',
            req,
            details: {
                solicitudCambioId: solicitud.id,
                entidad: solicitud.entidad,
                entidadId: solicitud.entidadId,
                tipoAccion: solicitud.tipoAccion
            }
        });

        return res.status(200).json({
            message: 'Cambio aprobado y aplicado con exito',
            data: resultado
        });
    } catch (error: any) {
        console.error('Error al aprobar el cambio: ', error);

        registerAudit({
            action: 'APROBAR_CAMBIO',
            module: 'CAMBIOS',
            status: 'FAILED',
            req,
            details: {
                solicitudCambioId: parseId(id),
                error: error.message
            }
        });

        return res.status(500).json({
            message: 'Error al aprobar el cambio'
        });
    }
}
//#endregion

//#region Rechazar Cambio
export const rechazarCambio = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;

    try {
        const idSolicitud = parseId(id);

        if (!idSolicitud) {
            return res.status(400).json({
                message: 'El ID de la solicitud no es valido'
            });
        }

        if (!motivo_rechazo) {
            return res.status(400).json({
                message: 'motivo_rechazo es obligatorio para rechazar una solicitud'
            });
        }

        const empleadoCoordinador = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoCoordinador) {
            return res.status(404).json({
                message: 'No se encontro un empleado asociado al usuario en sesion'
            });
        }

        const solicitud = await prisma.solicitudCambio.findUnique({
            where: { id: idSolicitud }
        });

        if (!solicitud) {
            return res.status(404).json({
                message: 'Solicitud de cambio no encontrada'
            });
        }

        if (solicitud.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: 'Esta solicitud ya fue procesada',
                error: `Estado actual: ${solicitud.estado}`
            });
        }

        const solicitudRechazada = await prisma.solicitudCambio.update({
            where: { id: solicitud.id },
            data: {
                estado: 'RECHAZADA',
                coordinadorId: empleadoCoordinador.id,
                motivoRechazo: motivo_rechazo
            }
        });

        registerAudit({
            action: 'RECHAZAR_CAMBIO',
            module: 'CAMBIOS',
            status: 'SUCCESS',
            req,
            details: {
                solicitudCambioId: solicitud.id,
                motivo_rechazo
            }
        });

        return res.status(200).json({
            message: 'Solicitud de cambio rechazada',
            data: solicitudRechazada
        });
    } catch (error: any) {
        console.error('Error al rechazar el cambio: ', error);

        registerAudit({
            action: 'RECHAZAR_CAMBIO',
            module: 'CAMBIOS',
            status: 'FAILED',
            req,
            details: {
                solicitudCambioId: parseId(id),
                error: error.message
            }
        });

        return res.status(500).json({
            message: 'Error al rechazar el cambio'
        });
    }
}
//#endregion
