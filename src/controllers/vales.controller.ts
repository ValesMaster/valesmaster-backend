import { Request, Response } from "express";
import prisma from "../lib/prisma";

const TIPOS_VALE_PERMITIDOS = ['EFECTIVO', 'MERCANCIA'];
const ESTADOS_APROBACION_PERMITIDOS = ['APROBADO', 'RECHAZADO'];

const COMISION_POR_CATEGORIA: Record<string, number> = {
    'Cobre': 0.03,
    'Plata': 0.06,
    'Oro': 0.10
};

const PORCENTAJE_SEGURO = 0.02;

//#region Crear Prevale
export const crearPrevale = async (req: Request, res: Response) => {
    const { cliente_id, cantidad_solicitada, plazos, tipo_vale } = req.body;

    try {
        if (!cliente_id || !cantidad_solicitada || !plazos || !tipo_vale) {
            return res.status(400).json({
                message: "cliente_id, cantidad_solicitada, plazos y tipo_vale son obligatorios"
            });
        }

        if (!TIPOS_VALE_PERMITIDOS.includes(tipo_vale)) {
            return res.status(400).json({
                message: "tipo_vale invalido",
                error: `El tipo de vale debe ser uno de: ${TIPOS_VALE_PERMITIDOS.join(', ')}`
            });
        }

        const cantidadSolicitadaNum = Number(cantidad_solicitada);
        const plazosNum = Number(plazos);

        if (isNaN(cantidadSolicitadaNum) || cantidadSolicitadaNum <= 0) {
            return res.status(400).json({
                message: "cantidad_solicitada debe ser un numero mayor a 0"
            });
        }

        if (!Number.isInteger(plazosNum) || plazosNum <= 0) {
            return res.status(400).json({
                message: "plazos debe ser un numero entero mayor a 0"
            });
        }

        const distribuidora = await prisma.distribuidora.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!distribuidora) {
            return res.status(404).json({
                message: "No se encontro una distribuidora asociada al usuario en sesion"
            });
        }

        const clienteExistente = await prisma.cliente.findFirst({
            where: {
                id: Number(cliente_id),
                distribuidoraId: distribuidora.id
            }
        });

        if (!clienteExistente) {
            return res.status(404).json({
                message: "El cliente no existe o no pertenece a esta distribuidora"
            });
        }

        const limiteCredito = Number(distribuidora.limiteCredito ?? 0);
        const creditoUsado = Number(distribuidora.creditoUsado ?? 0);
        const creditoDisponible = limiteCredito - creditoUsado;
        const creditoMinimoRequerido = limiteCredito * 0.5;

        if (creditoDisponible < creditoMinimoRequerido) {
            return res.status(400).json({
                message: "No se pueden crear mas prevales/vales por el momento",
                error: `La distribuidora debe tener al menos el 50% de su limite de credito disponible (minimo requerido: ${creditoMinimoRequerido}, disponible: ${creditoDisponible})`
            });
        }

        if (creditoDisponible < cantidadSolicitadaNum) {
            return res.status(400).json({
                message: "Credito insuficiente para solicitar este prevale",
                error: `Credito disponible: ${creditoDisponible}`
            });
        }

        const nuevoPrevale = await prisma.$transaction(async (tx) => {
            const prevale = await tx.prevale.create({
                data: {
                    clienteId: clienteExistente.id,
                    distribuidoraId: distribuidora.id,
                    cantidadSolicitada: cantidadSolicitadaNum,
                    plazos: plazosNum,
                    tipoVale: tipo_vale,
                    estado: 'PENDIENTE'
                }
            });

            const cantidadPorQuincena = Math.round((cantidadSolicitadaNum / plazosNum) * 100) / 100;

            for (let quincena = 1; quincena <= plazosNum; quincena++) {
                const fechaCorteEstimada = new Date();
                fechaCorteEstimada.setDate(fechaCorteEstimada.getDate() + (quincena * 15));

                await tx.prevaleDetallePago.create({
                    data: {
                        prevaleId: prevale.id,
                        quincena,
                        fechaCorteEstimada,
                        cantidadEstimada: cantidadPorQuincena
                    }
                });
            }

            return tx.prevale.findUnique({
                where: { id: prevale.id },
                include: {
                    detallesPagos: true,
                    cliente: {
                        select: {
                            id: true,
                            persona: { select: { nombre: true, apellidoPaterno: true } }
                        }
                    }
                }
            });
        });

        return res.status(201).json({
            message: "Prevale creado con exito",
            data: nuevoPrevale
        });
    } catch (error: any) {
        console.error("Error al crear el prevale: ", error);
        return res.status(500).json({
            message: "Error al crear el prevale",
            error: error.message
        });
    }
}
//#endregion

//#region Aprobar Prevale
export const aprobarPrevale = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado, motivo_rechazo } = req.body;

    try {
        if (!estado || !ESTADOS_APROBACION_PERMITIDOS.includes(estado)) {
            return res.status(400).json({
                message: "Estado invalido",
                error: `El estado debe ser uno de: ${ESTADOS_APROBACION_PERMITIDOS.join(', ')}`
            });
        }

        if (estado === 'RECHAZADO' && !motivo_rechazo) {
            return res.status(400).json({
                message: "motivo_rechazo es obligatorio para rechazar un prevale"
            });
        }

        const empleadoCoordinador = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoCoordinador) {
            return res.status(404).json({
                message: "No se encontro un empleado asociado al usuario en sesion"
            });
        }

        const prevale = await prisma.prevale.findUnique({
            where: { id: Number(id) },
            include: { distribuidora: true }
        });

        if (!prevale) {
            return res.status(404).json({
                message: "Prevale no encontrado"
            });
        }

        if (prevale.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: "Este prevale ya fue procesado",
                error: `Estado actual: ${prevale.estado}`
            });
        }

        if (estado === 'RECHAZADO') {
            const prevaleRechazado = await prisma.prevale.update({
                where: { id: prevale.id },
                data: {
                    estado: 'RECHAZADO',
                    motivoRechazo: motivo_rechazo,
                    coordinadorId: empleadoCoordinador.id
                }
            });

            return res.status(200).json({
                message: "Prevale rechazado con exito",
                data: prevaleRechazado
            });
        }

        const cantidadSolicitada = prevale.cantidadSolicitada.toNumber();
        const limiteCredito = Number(prevale.distribuidora.limiteCredito ?? 0);
        const creditoUsado = Number(prevale.distribuidora.creditoUsado ?? 0);
        const creditoDisponible = limiteCredito - creditoUsado;

        if (creditoDisponible < cantidadSolicitada) {
            return res.status(400).json({
                message: "La distribuidora ya no cuenta con credito disponible suficiente para aprobar este prevale",
                error: `Credito disponible: ${creditoDisponible}`
            });
        }

        const porcentajeComision = COMISION_POR_CATEGORIA[prevale.distribuidora.categoria ?? 'Cobre'];

        if (porcentajeComision === undefined) {
            return res.status(400).json({
                message: "La categoria de la distribuidora no es valida para calcular la comision",
                error: `Categoria actual: ${prevale.distribuidora.categoria}`
            });
        }

        const gananciaDistribuidora = Math.round(cantidadSolicitada * porcentajeComision * 100) / 100;
        const montoSeguro = Math.round(cantidadSolicitada * PORCENTAJE_SEGURO * 100) / 100;

        const resultadoAprobacion = await prisma.$transaction(async (tx) => {
            await tx.prevale.update({
                where: { id: prevale.id },
                data: {
                    estado: 'APROBADO',
                    coordinadorId: empleadoCoordinador.id
                }
            });

            const nuevoVale = await tx.vale.create({
                data: {
                    prevaleId: prevale.id,
                    clienteId: prevale.clienteId,
                    distribuidoraId: prevale.distribuidoraId,
                    cantidadPrestada: cantidadSolicitada,
                    cantidadPagada: 0,
                    estado: 'VIGENTE',
                    plazos: prevale.plazos,
                    tipoVale: prevale.tipoVale,
                    porcentajeComision,
                    gananciaDistribuidora,
                    montoSeguro
                }
            });

            await tx.distribuidora.update({
                where: { id: prevale.distribuidoraId },
                data: {
                    creditoUsado: creditoUsado + cantidadSolicitada
                }
            });

            return nuevoVale;
        });

        return res.status(200).json({
            message: "Prevale aprobado y vale creado con exito",
            data: resultadoAprobacion
        });
    } catch (error: any) {
        console.error("Error al aprobar el prevale: ", error);
        return res.status(500).json({
            message: "Error al aprobar el prevale",
            error: error.message
        });
    }
}
//#endregion
