import { Request, Response } from "express";
import prisma, { prismaRead } from "../lib/prisma";
import { parseId, parsePagination } from "../utils/validation";

const TIPOS_VALE_PERMITIDOS = ['EFECTIVO', 'MERCANCIA'];
const ESTADOS_APROBACION_PERMITIDOS = ['APROBADO', 'RECHAZADO'];
const PLAZOS_MAXIMO = 24;

const COMISION_POR_CATEGORIA: Record<string, number> = {
    'Cobre': 0.03,
    'Plata': 0.06,
    'Oro': 0.10
};

const PORCENTAJE_SEGURO = 0.02;
const MULTA_ATRASO = 300;
const MONTO_REFERENCIA_PUNTOS = 100;
const CUENTA_EMPRESA_PLACEHOLDER = '000000000000000000';

const soloFecha = (fecha: Date) => new Date(fecha).toISOString().slice(0, 10);

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

        if (!Number.isInteger(plazosNum) || plazosNum <= 0 || plazosNum > PLAZOS_MAXIMO) {
            return res.status(400).json({
                message: `plazos debe ser un numero entero entre 1 y ${PLAZOS_MAXIMO}`
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
            message: "Error al crear el prevale"
        });
    }
}
//#endregion

//#region Aprobar Prevale
export const aprobarPrevale = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado, motivo_rechazo } = req.body;

    try {
        const idPrevale = parseId(id);

        if (!idPrevale) {
            return res.status(400).json({
                message: "El ID del prevale no es valido"
            });
        }

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
            where: { id: idPrevale },
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

        if (!prevale.distribuidora.cuentaBancaria) {
            return res.status(400).json({
                message: "La distribuidora no tiene una cuenta bancaria registrada, es necesario registrarla antes de aprobar prevales"
            });
        }

        const capitalPorPago = Math.round((cantidadSolicitada / prevale.plazos) * 100) / 100;
        const seguroPorPago = Math.round((montoSeguro / prevale.plazos) * 100) / 100;
        const cantidadPorPagoNormal = Math.round((capitalPorPago + seguroPorPago) * 100) / 100;

        const montoTotalARegresarEmpresa = cantidadSolicitada - gananciaDistribuidora + montoSeguro;
        const cuotaPagoDistribuidora = Math.round((montoTotalARegresarEmpresa / prevale.plazos) * 100) / 100;

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

            for (let quincena = 1; quincena <= prevale.plazos; quincena++) {
                const fechaCorte = new Date();
                fechaCorte.setDate(fechaCorte.getDate() + (quincena * 15));

                await tx.pago.create({
                    data: {
                        valeId: nuevoVale.id,
                        quincena,
                        estado: 'PENDIENTE',
                        fechaCorte,
                        cantidadAPagar: cantidadPorPagoNormal,
                        cantidadPagada: 0,
                        cuenta_destino: prevale.distribuidora.cuentaBancaria!
                    }
                });
            }

            const nuevoCredito = await tx.credito.create({
                data: {
                    distribuidoraId: prevale.distribuidoraId,
                    valeId: nuevoVale.id,
                    cantidadUsada: cantidadSolicitada,
                    cantidadLiquidada: 0,
                    plazos: prevale.plazos
                }
            });

            for (let plazo = 1; plazo <= prevale.plazos; plazo++) {
                const fechaCorte = new Date();
                fechaCorte.setDate(fechaCorte.getDate() + (plazo * 15));

                await tx.pagosDistribuidora.create({
                    data: {
                        relacionId: nuevoCredito.id,
                        referencia: `PD-${nuevoCredito.id}-${plazo}`,
                        cantidadPagada: 0,
                        cantidadAPagar: cuotaPagoDistribuidora,
                        metodoPago: 'PENDIENTE',
                        plazo,
                        fechaCorte,
                        cuentaDestino: CUENTA_EMPRESA_PLACEHOLDER
                    }
                });
            }

            return nuevoVale;
        });

        return res.status(200).json({
            message: "Prevale aprobado y vale creado con exito",
            data: resultadoAprobacion
        });
    } catch (error: any) {
        console.error("Error al aprobar el prevale: ", error);
        return res.status(500).json({
            message: "Error al aprobar el prevale"
        });
    }
}
//#endregion

//#region Obtener Vales
export const obtenerVales = async (req: Request, res: Response) => {
    try {
        const { page, limit, estado, distribuidora_id, search } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const whereClause: any = {};

        if (estado) {
            whereClause.estado = String(estado).toUpperCase();
        }

        if (req.user!.rol === 'distribuidora') {
            const distribuidoraPropia = await prismaRead.distribuidora.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!distribuidoraPropia) {
                return res.status(404).json({
                    message: "No se encontro una distribuidora asociada al usuario en sesion"
                });
            }

            whereClause.distribuidoraId = distribuidoraPropia.id;
        } else if (req.user!.rol === 'cajero') {
            const empleadoCajero = await prismaRead.empleado.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!empleadoCajero) {
                return res.status(404).json({
                    message: "No se encontro un empleado asociado al usuario en sesion"
                });
            }

            whereClause.distribuidora = { sucursalId: empleadoCajero.sucursalId };
        } else if (distribuidora_id) {
            whereClause.distribuidoraId = Number(distribuidora_id);
        }

        if (search) {
            whereClause.OR = [
                {
                    cliente: {
                        persona: {
                            OR: [
                                { nombre: { contains: String(search), mode: 'insensitive' } },
                                { apellidoPaterno: { contains: String(search), mode: 'insensitive' } }
                            ]
                        }
                    }
                },
                {
                    distribuidora: {
                        usuario: { username: { contains: String(search), mode: 'insensitive' } }
                    }
                }
            ];
        }

        const [vales, total] = await Promise.all([
            prismaRead.vale.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    cliente: {
                        select: {
                            id: true,
                            persona: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } }
                        }
                    },
                    distribuidora: {
                        select: {
                            id: true,
                            categoria: true,
                            usuario: { select: { username: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.vale.count({ where: whereClause })
        ]);

        return res.status(200).json({
            message: 'Vales obtenidos con exito',
            data: vales,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error('Error al obtener los vales: ', error);
        return res.status(500).json({
            message: 'Error al obtener los vales'
        });
    }
}
//#endregion

//#region Obtener Prevales
export const obtenerPrevales = async (req: Request, res: Response) => {
    try {
        const { page, limit, estado, distribuidora_id, search } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const whereClause: any = {};

        if (estado) {
            whereClause.estado = String(estado).toUpperCase();
        }

        if (req.user!.rol === 'distribuidora') {
            const distribuidoraPropia = await prismaRead.distribuidora.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!distribuidoraPropia) {
                return res.status(404).json({
                    message: "No se encontro una distribuidora asociada al usuario en sesion"
                });
            }

            whereClause.distribuidoraId = distribuidoraPropia.id;
        } else if (distribuidora_id) {
            whereClause.distribuidoraId = Number(distribuidora_id);
        }

        if (search) {
            whereClause.OR = [
                {
                    cliente: {
                        persona: {
                            OR: [
                                { nombre: { contains: String(search), mode: 'insensitive' } },
                                { apellidoPaterno: { contains: String(search), mode: 'insensitive' } }
                            ]
                        }
                    }
                },
                {
                    distribuidora: {
                        usuario: { username: { contains: String(search), mode: 'insensitive' } }
                    }
                }
            ];
        }

        const [prevales, total] = await Promise.all([
            prismaRead.prevale.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    cliente: {
                        select: {
                            id: true,
                            persona: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } }
                        }
                    },
                    distribuidora: {
                        select: {
                            id: true,
                            categoria: true,
                            usuario: { select: { username: true } }
                        }
                    },
                    coordinador: {
                        select: {
                            id: true,
                            usuario: { select: { username: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.prevale.count({ where: whereClause })
        ]);

        return res.status(200).json({
            message: "Prevales obtenidos con exito",
            data: prevales,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error("Error al obtener los prevales: ", error);
        return res.status(500).json({
            message: "Error al obtener los prevales"
        });
    }
}
//#endregion

//#region Obtener Detalle Prevale
export const obtenerDetallePrevale = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idPrevale = parseId(id);

        if (!idPrevale) {
            return res.status(400).json({
                message: 'El ID del prevale no es valido'
            });
        }

        const prevale = await prismaRead.prevale.findUnique({
            where: { id: idPrevale },
            include: {
                cliente: {
                    include: { persona: true }
                },
                distribuidora: {
                    include: { usuario: { select: { username: true, email: true } } }
                },
                coordinador: {
                    include: { usuario: { select: { username: true, email: true } } }
                },
                detallesPagos: true,
                vales: true
            }
        });

        if (!prevale) {
            return res.status(404).json({
                message: 'Prevale no encontrado'
            });
        }

        if (req.user!.rol === 'distribuidora') {
            const distribuidoraPropia = await prismaRead.distribuidora.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!distribuidoraPropia || distribuidoraPropia.id !== prevale.distribuidoraId) {
                return res.status(403).json({
                    message: 'No tiene permiso para consultar este prevale'
                });
            }
        }

        return res.status(200).json({
            message: 'Detalle de prevale obtenido con exito',
            data: prevale
        });
    } catch (error: any) {
        console.error('Error al obtener el detalle del prevale: ', error);
        return res.status(500).json({
            message: 'Error al obtener el detalle del prevale'
        });
    }
}
//#endregion

//#region Obtener Detalle Vale
export const obtenerDetalleVale = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idVale = parseId(id);

        if (!idVale) {
            return res.status(400).json({
                message: "El ID del vale no es valido"
            });
        }

        const vale = await prismaRead.vale.findUnique({
            where: { id: idVale },
            include: {
                cliente: {
                    include: { persona: true }
                },
                distribuidora: {
                    include: { usuario: { select: { username: true, email: true } } }
                },
                prevale: {
                    include: {
                        coordinador: {
                            include: { usuario: { select: { username: true } } }
                        }
                    }
                },
                pagos: { orderBy: { quincena: 'asc' } },
                credito: {
                    include: {
                        pagosDistribuidor: { orderBy: { plazo: 'asc' } }
                    }
                }
            }
        });

        if (!vale) {
            return res.status(404).json({
                message: "Vale no encontrado"
            });
        }

        if (req.user!.rol === 'distribuidora') {
            const distribuidoraPropia = await prismaRead.distribuidora.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!distribuidoraPropia || distribuidoraPropia.id !== vale.distribuidoraId) {
                return res.status(403).json({
                    message: "No tiene permiso para consultar este vale"
                });
            }
        }

        if (req.user!.rol === 'cajero') {
            const empleadoCajero = await prismaRead.empleado.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!empleadoCajero || empleadoCajero.sucursalId !== vale.distribuidora.sucursalId) {
                return res.status(403).json({
                    message: "No tiene permiso para consultar vales de otra sucursal"
                });
            }
        }

        return res.status(200).json({
            message: "Detalle de vale obtenido con exito",
            data: vale
        });
    } catch (error: any) {
        console.error("Error al obtener el detalle del vale: ", error);
        return res.status(500).json({
            message: "Error al obtener el detalle del vale"
        });
    }
}
//#endregion

//#region Registrar Pago
export const registrarPago = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idPago = parseId(id);

        if (!idPago) {
            return res.status(400).json({
                message: "El ID del pago no es valido"
            });
        }

        const empleadoCajero = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoCajero) {
            return res.status(404).json({
                message: "No se encontro un empleado asociado al usuario en sesion"
            });
        }

        const pago = await prisma.pago.findUnique({
            where: { id: idPago },
            include: {
                vale: {
                    include: { distribuidora: true }
                }
            }
        });

        if (!pago) {
            return res.status(404).json({
                message: "Pago no encontrado"
            });
        }

        if (pago.vale.distribuidora.sucursalId !== empleadoCajero.sucursalId) {
            return res.status(403).json({
                message: "No tiene permiso para registrar pagos de distribuidoras de otra sucursal"
            });
        }

        if (pago.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: "Este pago ya fue registrado o no esta disponible para cobro",
                error: `Estado actual: ${pago.estado}`
            });
        }

        const pagosAnterioresSinResolver = await prisma.pago.count({
            where: {
                valeId: pago.valeId,
                quincena: { lt: pago.quincena - 1 },
                estado: 'PENDIENTE'
            }
        });

        if (pagosAnterioresSinResolver > 0) {
            return res.status(400).json({
                message: "Hay pagos anteriores sin resolver, deben registrarse en orden"
            });
        }

        const pagoAnterior = pago.quincena > 1
            ? await prisma.pago.findFirst({
                where: { valeId: pago.valeId, quincena: pago.quincena - 1 }
            })
            : null;

        const hoy = new Date();
        const hoyStr = soloFecha(hoy);

        const huboAtrasoAnterior = !!pagoAnterior
            && pagoAnterior.estado === 'PENDIENTE'
            && soloFecha(pagoAnterior.fechaCorte) < hoyStr;

        if (pagoAnterior && pagoAnterior.estado === 'PENDIENTE' && !huboAtrasoAnterior) {
            return res.status(400).json({
                message: "Todavia no se puede registrar este pago, el pago anterior sigue pendiente y aun no vence"
            });
        }

        let tipoComportamiento: string;
        let puntosGanados = 0;

        if (hoyStr < soloFecha(pago.fechaCorte)) {
            tipoComportamiento = 'ANTICIPADO';
        } else if (hoyStr === soloFecha(pago.fechaCorte)) {
            tipoComportamiento = 'PUNTUAL';
        } else {
            tipoComportamiento = 'ATRASADO';
        }

        let comisionPerdidaTotal = 0;

        const resultado = await prisma.$transaction(async (tx) => {
            let cantidadPagadaAnterior = 0;

            if (huboAtrasoAnterior && pagoAnterior) {
                cantidadPagadaAnterior = Math.round((Number(pagoAnterior.cantidadAPagar) + MULTA_ATRASO) * 100) / 100;

                await tx.pago.update({
                    where: { id: pagoAnterior.id },
                    data: {
                        estado: 'PAGADO',
                        fechaPago: hoy,
                        cantidadPagada: cantidadPagadaAnterior,
                        multaGenerada: MULTA_ATRASO,
                        estadoMulta: 'PAGADA',
                        tipoComportamiento: 'ATRASADO'
                    }
                });

                const comisionPorPago = Math.round((Number(pago.vale.gananciaDistribuidora) / pago.vale.plazos) * 100) / 100;
                comisionPerdidaTotal = comisionPorPago;

                await tx.distribuidora.update({
                    where: { id: pago.vale.distribuidoraId },
                    data: {
                        creditoUsado: { increment: comisionPorPago }
                    }
                });
            }

            const cantidadPagadaActual = Number(pago.cantidadAPagar);

            if (tipoComportamiento === 'ANTICIPADO') {
                puntosGanados = Math.floor(cantidadPagadaActual / MONTO_REFERENCIA_PUNTOS);

                if (puntosGanados > 0) {
                    await tx.distribuidora.update({
                        where: { id: pago.vale.distribuidoraId },
                        data: {
                            puntos: { increment: puntosGanados }
                        }
                    });
                }
            }

            const pagoActualizado = await tx.pago.update({
                where: { id: pago.id },
                data: {
                    estado: 'PAGADO',
                    fechaPago: hoy,
                    cantidadPagada: cantidadPagadaActual,
                    tipoComportamiento
                }
            });

            const totalRegistrado = Math.round((cantidadPagadaActual + cantidadPagadaAnterior) * 100) / 100;

            await tx.vale.update({
                where: { id: pago.valeId },
                data: {
                    cantidadPagada: { increment: totalRegistrado }
                }
            });

            const pagosPendientesRestantes = await tx.pago.count({
                where: { valeId: pago.valeId, estado: 'PENDIENTE' }
            });

            if (pagosPendientesRestantes === 0) {
                await tx.vale.update({
                    where: { id: pago.valeId },
                    data: { estado: 'LIQUIDADO' }
                });
            }

            return { pagoActualizado, totalRegistrado };
        });

        return res.status(200).json({
            message: "Pago registrado con exito",
            data: {
                pago: resultado.pagoActualizado,
                desglose: {
                    cantidadPropia: Number(pago.cantidadAPagar),
                    atrasoAnteriorIncluido: huboAtrasoAnterior,
                    multaCobrada: huboAtrasoAnterior ? MULTA_ATRASO : 0,
                    totalCobrado: resultado.totalRegistrado,
                    puntosGanados,
                    comisionPerdidaDistribuidora: comisionPerdidaTotal
                }
            }
        });
    } catch (error: any) {
        console.error("Error al registrar el pago: ", error);
        return res.status(500).json({
            message: "Error al registrar el pago"
        });
    }
}
//#endregion

//#region Registrar Pago Distribuidora
export const registrarPagoDistribuidora = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { metodo_pago } = req.body;

    try {
        const idPagoDistribuidora = parseId(id);

        if (!idPagoDistribuidora) {
            return res.status(400).json({
                message: "El ID del pago no es valido"
            });
        }

        if (!metodo_pago) {
            return res.status(400).json({
                message: "metodo_pago es obligatorio"
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

        const pagoDistribuidora = await prisma.pagosDistribuidora.findUnique({
            where: { id: idPagoDistribuidora },
            include: {
                credito: true
            }
        });

        if (!pagoDistribuidora) {
            return res.status(404).json({
                message: "Pago de distribuidora no encontrado"
            });
        }

        if (pagoDistribuidora.fechaPago) {
            return res.status(400).json({
                message: "Este pago ya fue registrado"
            });
        }

        const pagosAnterioresSinResolver = await prisma.pagosDistribuidora.count({
            where: {
                relacionId: pagoDistribuidora.relacionId,
                plazo: { lt: pagoDistribuidora.plazo },
                fechaPago: null
            }
        });

        if (pagosAnterioresSinResolver > 0) {
            return res.status(400).json({
                message: "Hay pagos anteriores sin resolver, deben registrarse en orden"
            });
        }

        const credito = pagoDistribuidora.credito;
        const capitalPorCuota = Math.round((Number(credito.cantidadUsada) / Number(credito.plazos)) * 100) / 100;
        const hoy = new Date();

        const resultado = await prisma.$transaction(async (tx) => {
            const pagoActualizado = await tx.pagosDistribuidora.update({
                where: { id: pagoDistribuidora.id },
                data: {
                    fechaPago: hoy,
                    cantidadPagada: pagoDistribuidora.cantidadAPagar,
                    metodoPago: metodo_pago
                }
            });

            await tx.credito.update({
                where: { id: credito.id },
                data: {
                    cantidadLiquidada: { increment: capitalPorCuota }
                }
            });

            await tx.distribuidora.update({
                where: { id: credito.distribuidoraId },
                data: {
                    creditoUsado: { decrement: capitalPorCuota }
                }
            });

            return pagoActualizado;
        });

        return res.status(200).json({
            message: "Pago a la empresa registrado con exito",
            data: {
                pago: resultado,
                capitalLiberado: capitalPorCuota
            }
        });
    } catch (error: any) {
        console.error("Error al registrar el pago de la distribuidora: ", error);
        return res.status(500).json({
            message: "Error al registrar el pago de la distribuidora"
        });
    }
}
//#endregion

//#region Conciliacion Pagos (Cliente -> Distribuidora)
export const obtenerConciliacionPagos = async (req: Request, res: Response) => {
    try {
        const { page, limit, distribuidora_id } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const valeFilter: any = {};

        if (distribuidora_id) {
            valeFilter.distribuidoraId = Number(distribuidora_id);
        }

        if (req.user!.rol === 'cajero') {
            const empleadoCajero = await prismaRead.empleado.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!empleadoCajero) {
                return res.status(404).json({
                    message: "No se encontro un empleado asociado al usuario en sesion"
                });
            }

            valeFilter.distribuidora = { sucursalId: empleadoCajero.sucursalId };
        }

        const hoy = new Date();

        const whereClause: any = {
            estado: 'PENDIENTE',
            fechaCorte: { lt: hoy },
            ...(Object.keys(valeFilter).length > 0 ? { vale: valeFilter } : {})
        };

        const [pagos, total] = await Promise.all([
            prismaRead.pago.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    vale: {
                        include: {
                            cliente: { include: { persona: true } },
                            distribuidora: { include: { usuario: { select: { username: true } } } }
                        }
                    }
                },
                orderBy: { fechaCorte: 'asc' }
            }),
            prismaRead.pago.count({ where: whereClause })
        ]);

        const pagosConAtraso = pagos.map(p => ({
            ...p,
            diasAtraso: Math.floor((hoy.getTime() - new Date(p.fechaCorte).getTime()) / 86400000)
        }));

        return res.status(200).json({
            message: "Pagos pendientes de conciliar obtenidos con exito",
            data: pagosConAtraso,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error("Error al obtener la conciliacion de pagos: ", error);
        return res.status(500).json({
            message: "Error al obtener la conciliacion de pagos"
        });
    }
}
//#endregion

//#region Conciliacion Pagos Distribuidora (Distribuidora -> Empresa)
export const obtenerConciliacionPagosDistribuidora = async (req: Request, res: Response) => {
    try {
        const { page, limit, distribuidora_id } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const creditoFilter: any = {};

        if (distribuidora_id) {
            creditoFilter.distribuidoraId = Number(distribuidora_id);
        }

        if (req.user!.rol === 'cajero') {
            const empleadoCajero = await prismaRead.empleado.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!empleadoCajero) {
                return res.status(404).json({
                    message: "No se encontro un empleado asociado al usuario en sesion"
                });
            }

            creditoFilter.distribuidora = { sucursalId: empleadoCajero.sucursalId };
        }

        const hoy = new Date();

        const whereClause: any = {
            fechaPago: null,
            fechaCorte: { lt: hoy },
            ...(Object.keys(creditoFilter).length > 0 ? { credito: creditoFilter } : {})
        };

        const [pagos, total] = await Promise.all([
            prismaRead.pagosDistribuidora.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    credito: {
                        include: {
                            distribuidora: { include: { usuario: { select: { username: true } } } }
                        }
                    }
                },
                orderBy: { fechaCorte: 'asc' }
            }),
            prismaRead.pagosDistribuidora.count({ where: whereClause })
        ]);

        const pagosConAtraso = pagos.map(p => ({
            ...p,
            diasAtraso: Math.floor((hoy.getTime() - new Date(p.fechaCorte).getTime()) / 86400000)
        }));

        return res.status(200).json({
            message: "Pagos de distribuidora pendientes de conciliar obtenidos con exito",
            data: pagosConAtraso,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error("Error al obtener la conciliacion de pagos de distribuidora: ", error);
        return res.status(500).json({
            message: "Error al obtener la conciliacion de pagos de distribuidora"
        });
    }
}
//#endregion
