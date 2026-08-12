import { Request, Response } from "express";
import bcrypt from "bcrypt"
import prisma, { prismaRead } from "../lib/prisma";

//#region Crear Presolicitud 
export const crearPresolicitud = async (req: Request, res: Response) => {
    const {
        //PERSONA
        nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono,
        genero, curp, rfc, ine, comprobante_domicilio,

        //DIRECCION
        estado, municipio, codigo_postal, colonia, calle, numero_exterior, numero_interior,
        referencia,

        //PRESOLICITUD
        sucursal_id, coordinador_id, correo_solicitante,

        //ARRAYS
        vehiculos,
        negocios,
        familiares
    } = req.body;

    try {
        const folioGenerado = `PRE-${Date.now().toString().slice(-6)}`;

        const nuevaPresolicitud = await prisma.$transaction(async (tx) => {
            const nuevaDireccion = await tx.direccion.create({
                data: {
                    estado,
                    municipio,
                    codigoPostal: codigo_postal,
                    colonia,
                    calle,
                    numeroExterior: numero_exterior,
                    numeroInterior: numero_interior,
                    referencia
                }
            });

            const nuevaPersona = await tx.persona.create({
                data: {
                    nombre,
                    apellidoPaterno: apellido_paterno,
                    apellidoMaterno: apellido_materno,
                    fechaNacimiento: new Date(fecha_nacimiento),
                    telefono,
                    genero,
                    curp,
                    rfc,
                    ine,
                    comprobanteDomicilio: comprobante_domicilio,
                    direccionId: nuevaDireccion.id
                }
            });

            const presolicitud = await tx.presolicitud.create({
                data: {
                    folio: folioGenerado,
                    personaId: nuevaPersona.id,
                    sucursalId: Number(sucursal_id),
                    validadorId: null,
                    coordinadorId: coordinador_id ? Number(coordinador_id) : null,
                    estado: 'PENDIENTE',
                    correoSolicitante: correo_solicitante
                }
            });

            if (!familiares) {
                return res.status(400).json({
                    message: "Es necesario registrar a los familiares directos del solicitante"
                });
            }

            if (!negocios) {
                return res.status(400).json({
                    message: "Es necesario registrar los negocios en los que el solicitante ha estado"
                });
            }

            if (vehiculos && Array.isArray(vehiculos) && vehiculos.length > 0) {
                for (const v of vehiculos) {
                    const vehiculoCreado = await tx.vehiculo.create({
                        data: {
                            marca: v.marca,
                            modelo: v.modelo,
                            placas: v.placas,
                            ano: v.ano,
                            color: v.color,
                            tipoVehiculo: v.tipoVehiculo
                        }
                    });

                    await tx.presolicitudesVehiculo.create({
                        data: {
                            presolicitudId: presolicitud.id,
                            vehiculoId: vehiculoCreado.id
                        }
                    });
                }
            }

            if (Array.isArray(negocios) && negocios.length > 0) {
                for (const n of negocios) {
                    const negocioCreado = await tx.negocio.create({
                        data: {
                            nombre: n.nombre,
                            sucursal: n.sucursal,
                            telefono: n.telefono
                        }
                    });

                    await tx.presolicitudesNegocio.create({
                        data: {
                            presolicitudId: presolicitud.id,
                            negocioId: negocioCreado.id,
                            carta: n.carta,
                            antiguedad: n.antiguedad ? new Date(n.antiguedad) : null
                        }
                    });
                }
            } else {
                return res.status(400).json({
                    message: "Es necesario enviar un arreglo valido de negocios"
                });
            }

            if (Array.isArray(familiares) && familiares.length > 0) {
                for (const f of familiares) {
                    const familiarCreado = await tx.persona.create({
                        data: {
                            nombre: f.nombre,
                            apellidoPaterno: f.apellido_paterno,
                            apellidoMaterno: f.apellido_materno,
                            telefono: f.telefono
                        }
                    });

                    await tx.presolicitudesFamiliar.create({
                        data: {
                            presolicitudId: presolicitud.id,
                            familiarId: familiarCreado.id,
                            relacion: f.relacion
                        }
                    });
                }
            } else {
                return res.status(400).json({
                    message: "Se requiere un array valido de familiares"
                });
            }

            return presolicitud;
        });

        return res.status(201).json({
            message: "Presolicitud creada con exito",
            data: nuevaPresolicitud
        });
    } catch (error: any) {
        console.error("Error al crear la presolicitud: ", error);
        return res.status(500).json({
            message: "Error al crear la presolicitud",
            error: error.message
        });
    }
}
//#endregion
//#region Validar Presolicitud
export const validarPresolicitud = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { validador_id, estado } = req.body;
    const estados_permitidos = ['VALIDADA', 'RECHAZADA'];

    try {
        const presolicitudExistente = await prisma.presolicitud.findUnique({
            where: { id: Number(id) }
        });

        if (!presolicitudExistente) {
            return res.status(404).json({
                message: "Presolicitud no encontrada"
            });
        }

        if (!estado || !estados_permitidos.includes(estado)) {
            return res.status(400).json({
                message: 'Estado invalido',
                error: 'El estado debe ser VALIDADA o RECHAZADA'
            });
        }

        const resultadoTransaccion = await prisma.$transaction(async (tx) => {
            const presolicitudActualizada = await tx.presolicitud.update({
                where: { id: Number(id) },
                data: {
                    estado: estado,
                    validadorId: Number(validador_id)
                },
                include: {
                    persona: true,
                    validador: {
                        include: {
                            usuario: {
                                select: { username: true, email: true }
                            }
                        }
                    }
                }
            });

            let nuevaSolicitud = null;
            if (estado == 'VALIDADA') {
                nuevaSolicitud = await tx.solicitud.create({
                    data: {
                        presolicitudId: presolicitudActualizada.id,
                        estado: 'PENDIENTE'
                    }
                });
            }

            return { presolicitudActualizada, nuevaSolicitud }
        });

        const mensaje = estado === 'VALIDADA'
            ? 'Solicitud validada con exito'
            : 'Solicitud rechazada con exito';

        return res.status(200).json({
            message: mensaje,
            data: resultadoTransaccion
        });
    } catch (error: any) {
        console.error("Error al validar presolicitud: ", error)
        res.status(500).json({
            message: "Error al validar presolicitud",
            error: error.message
        });
    }
}
//#region Aprobar 
export const aprobarSolicitud = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        estado, gerente_id,
        user_password, user_name
    } = req.body;
    const estadosPermitidos = ['APROBADA', 'RECHAZADA']

    try {
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                message: 'Error al aprobar solicitud',
                error: 'El estado solo puede ser APROBADA o RECHAZADA'
            })
        }

        const solicitudExistente = await prisma.solicitud.findUnique({
            where: { id: Number(id) }
        });

        if (!solicitudExistente) {
            return res.status(404).json({
                message: 'No se encontro la solicitud'
            });
        }

        const presolicitudRelacionada = await prisma.presolicitud.findUnique({
            where: { id: solicitudExistente.presolicitudId }
        });

        if (!presolicitudRelacionada) {
            return res.status(404).json({
                message: "No se encontro la presolicitud"
            });
        }

        if (presolicitudRelacionada.estado != 'VALIDADA') {
            return res.status(400).json({
                message: "Los datos de la presolicitud deben estar validados para aprobar la solicitud"
            });
        }

        if (estado == 'APROBADA') {
            const resultadoAprobacion = await prisma.$transaction(async (tx) => {
                const solicitudActualizada = await tx.solicitud.update({
                    where: { id: Number(solicitudExistente.id) },
                    data: {
                        estado: estado,
                        gerenteId: gerente_id
                    }
                });

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(user_password, salt);

                const usuarioDistribuidora = await tx.usuario.create({
                    data: {
                        email: presolicitudRelacionada.correoSolicitante!,
                        username: user_name,
                        personaId: presolicitudRelacionada.personaId,
                        rolId: 6,
                        password: hashedPassword
                    }
                });

                const nuevaDistribuidora = await tx.distribuidora.create({
                    data: {
                        usuarioId: usuarioDistribuidora.id,
                        sucursalId: presolicitudRelacionada.sucursalId,
                        puntos: 0.00,
                        limiteCredito: 10000.00,
                        creditoUsado: 0.00,
                        cantidadLiquidada: 0.00,
                        categoria: 'Cobre'
                    }
                });

                const presolicitudVehiculos = await tx.presolicitudesVehiculo.findMany({
                    where: { presolicitudId: presolicitudRelacionada.id }
                });

                for (const pv of presolicitudVehiculos) {
                    await tx.vehiculosDistribuidora.create({
                        data: {
                            distribuidoraId: nuevaDistribuidora.id,
                            vehiculoId: pv.vehiculoId
                        }
                    });
                }

                const presolicitudNegocios = await tx.presolicitudesNegocio.findMany({
                    where: { presolicitudId: presolicitudRelacionada.id }
                });

                for (const pn of presolicitudNegocios) {
                    await tx.negociosDistribuidora.create({
                        data: {
                            distribuidoraId: nuevaDistribuidora.id,
                            negocioId: pn.negocioId,
                            cartaConstancia: pn.carta,
                            antiguedad: pn.antiguedad
                        }
                    });
                }

                const presolicitudFamiliares = await tx.presolicitudesFamiliar.findMany({
                    where: { presolicitudId: presolicitudRelacionada.id }
                });

                for (const pf of presolicitudFamiliares) {
                    await tx.familiaresDistribuidora.create({
                        data: {
                            distribuidoraId: nuevaDistribuidora.id,
                            personaId: pf.familiarId,
                            relacion: pf.relacion
                        }
                    });
                }

                return {
                    solicitudActualizada,
                    usuarioDistribuidora,
                    nuevaDistribuidora
                };
            });

            return res.status(200).json({
                message: "Distribuidora aprobada y creada con exito",
                data: resultadoAprobacion
            });
        } else {
            const solicitudRechazada = await prisma.solicitud.update({
                where: { id: Number(id) },
                data: {
                    estado: estado,
                    gerenteId: Number(gerente_id)
                }
            });

            return res.status(200).json({
                message: 'Solicitud rechazada con exito',
                data: solicitudRechazada
            });
        }

    } catch (error: any) {
        return res.status(500).json({
            message: "Error al aprobar presolicitud",
            error: error.message
        });
    }
}
//#endregion
//#region Obtener Presolicitudes
export const getPresolicitudes = async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '10', estado, sucursal_id, search } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const whereClause: any = {};

        if (estado) {
            whereClause.estado = String(estado).toUpperCase();
        }

        if (sucursal_id) {
            whereClause.sucursalId = Number(sucursal_id);
        }

        if (search) {
            whereClause.OR = [
                { folio: { contains: String(search), mode: 'insensitive' } },
                { correoSolicitante: { contains: String(search), mode: 'insensitive' } },
                {
                    persona: {
                        OR: [
                            { nombre: { contains: String(search), mode: 'insensitive' } },
                            { apellidoPaterno: { contains: String(search), mode: 'insensitive' } },
                            { curp: { contains: String(search), mode: 'insensitive' } }
                        ]
                    }
                }
            ];
        }

        const [presolicitudes, total] = await Promise.all([
            prismaRead.presolicitud.findMany({
                where: whereClause,
                skip: skip,
                take: limitNumber,
                select: {
                    id: true,
                    folio: true,
                    estado: true,
                    correoSolicitante: true,
                    persona: {
                        select: {
                            nombre: true,
                            apellidoPaterno: true,
                            apellidoMaterno: true
                        }
                    },
                    sucursal: {
                        select: {
                            nombre: true
                        }
                    },
                    validador: {
                        select: {
                            id: true,
                            usuario: {
                                select: { username: true }
                            }
                        }
                    },
                    coordinador: {
                        select: {
                            id: true,
                            usuario: {
                                select: { username: true }
                            }
                        }
                    },
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.presolicitud.count({ where: whereClause })
        ]);

        const presolicitudesFormateadas = presolicitudes.map(p => ({
            id: p.id,
            folio: p.folio,
            nombreSolicitante: p.persona
                ? `${p.persona.nombre || ''} ${p.persona.apellidoPaterno || ''} ${p.persona.apellidoMaterno || ''}`.trim()
                : 'Sin nombre',
            sucursal: p.sucursal?.nombre || 'Sin sucursal',
            validador: p.validador?.usuario?.username || 'No asignado',
            coordinador: p.coordinador?.usuario?.username || 'No asignado',
            estado: p.estado,
            correoSolicitante: p.correoSolicitante,
            createdAt: p.createdAt
        }));

        return res.status(200).json({
            message: "Presolicitudes obtenidas con éxito",
            data: presolicitudesFormateadas,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });

    } catch (error: any) {
        console.error("Error al obtener presolicitudes: ", error);
        return res.status(500).json({
            message: "Error al obtener presolicitudes",
            error: error.message
        });
    }
};
//#endregion
//#region Obtener Solis

export const getSolicitudes = async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '10', estado, gerente_id } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const whereClause: any = {};

        if (estado) {
            whereClause.estado = String(estado).toUpperCase();
        }

        if (gerente_id) {
            whereClause.gerenteId = Number(gerente_id);
        }

        const [solicitudes, total] = await Promise.all([
            prismaRead.solicitud.findMany({
                where: whereClause,
                skip: skip,
                take: limitNumber,
                select: {
                    id: true,
                    estado: true,
                    gerenteId: true,
                    gerente: {
                        select: {
                            usuario: {
                                select: { username: true }
                            }
                        }
                    },
                    presolicitud: {
                        select: {
                            folio: true,
                            persona: {
                                select: {
                                    nombre: true,
                                    apellidoPaterno: true
                                }
                            }
                        }
                    },
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaRead.solicitud.count({ where: whereClause })
        ]);

        const solicitudesFormateadas = solicitudes.map(s => ({
            id: s.id,
            folioPresolicitud: s.presolicitud?.folio || 'N/A',
            nombreSolicitante: s.presolicitud?.persona
                ? `${s.presolicitud.persona.nombre} ${s.presolicitud.persona.apellidoPaterno}`
                : 'N/A',
            gerenteId: s.gerenteId,
            nombreGerente: s.gerente?.usuario?.username || 'No asignado',
            estado: s.estado,
            createdAt: s.createdAt
        }));

        return res.status(200).json({
            message: "Solicitudes obtenidas con éxito",
            data: solicitudesFormateadas,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });

    } catch (error: any) {
        console.error("Error al obtener solicitudes: ", error);
        return res.status(500).json({
            message: "Error al obtener solicitudes",
            error: error.message
        });
    }
};
//#region Solicitud

export const getPresolicitudDetalle = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const presolicitud = await prismaRead.presolicitud.findUnique({
            where: { id: Number(id) },
            include: {
                persona: {
                    include: {
                        direccion: true
                    }
                },
                sucursal: true,
                validador: {
                    include: {
                        usuario: { select: { username: true, email: true } }
                    }
                },
                coordinador: {
                    include: {
                        usuario: { select: { username: true, email: true } }
                    }
                },
                vehiculos: {
                    include: {
                        vehiculo: true
                    }
                },
                negocios: {
                    include: {
                        negocio: true
                    }
                },
                familiares: {
                    include: {
                        familiar: true
                    }
                }
            }
        });

        if (!presolicitud) {
            return res.status(404).json({
                message: "Presolicitud no encontrada"
            });
        }

        return res.status(200).json({
            message: "Detalle de presolicitud obtenido con éxito",
            data: presolicitud
        });

    } catch (error: any) {
        console.error("Error al obtener el detalle de la presolicitud: ", error);
        return res.status(500).json({
            message: "Error al obtener el detalle de la presolicitud",
            error: error.message
        });
    }
};