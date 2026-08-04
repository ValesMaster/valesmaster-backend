import { Request, Response } from "express";
import bcrypt from "bcrypt"
import prisma from "../lib/prisma";

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

export const AprobarSolicitud = async (req: Request, res: Response) => {
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