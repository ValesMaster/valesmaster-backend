import { Request, Response } from "express";
import bcrypt from "bcrypt"
import prisma, { prismaRead } from "../lib/prisma";
import path from "path";
import fs from "fs";
import { parseId, parsePagination, isValidEmail } from "../utils/validation";

const MAX_ITEMS_ARRAY = 20;
const PASSWORD_MIN_LENGTH = 8;

//#region Crear Presolicitud
export const crearPresolicitud = async (req: Request, res: Response) => {
    const {
        //PERSONA
        nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono,
        genero,

        //DIRECCION
        estado, municipio, codigo_postal, colonia, calle, numero_exterior, numero_interior,
        referencia,

        //PRESOLICITUD
        correo_solicitante,

        //ARRAYS
        vehiculos,
        negocios,
        familiares
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] }

    const ineFile = files?.['ine']?.[0]?.filename || null;
    const rfcFile = files?.['rfc']?.[0]?.filename || null;
    const curpFile = files?.['curp']?.[0]?.filename || null;
    const comprobanteFile = files?.['comprobante_domicilio']?.[0]?.filename || null;

    let parsedVehiculos = vehiculos;
    let parsedNegocios = negocios;
    let parsedFamiliares = familiares;

    if (typeof vehiculos === 'string') {
        try {
            parsedVehiculos = JSON.parse(vehiculos);
        } catch (e) {
            parsedVehiculos = [];
        }
    }
    if (typeof negocios === 'string') {
        try {
            parsedNegocios = JSON.parse(negocios);
        } catch (e) {
            parsedNegocios = [];
        }
    }
    if (typeof familiares === 'string') {
        try {
            parsedFamiliares = JSON.parse(familiares);
        } catch (e) {
            parsedFamiliares = [];
        }
    }

    try {
        if (!nombre || !apellido_paterno || !fecha_nacimiento || !estado || !municipio || !codigo_postal || !colonia || !calle || !numero_exterior) {
            return res.status(400).json({
                message: "nombre, apellido_paterno, fecha_nacimiento, estado, municipio, codigo_postal, colonia, calle y numero_exterior son obligatorios"
            });
        }

        if (correo_solicitante && !isValidEmail(correo_solicitante)) {
            return res.status(400).json({
                message: "correo_solicitante no tiene un formato valido"
            });
        }

        if (!Array.isArray(parsedNegocios) || parsedNegocios.length === 0) {
            return res.status(400).json({
                message: "Es necesario enviar un arreglo valido de negocios"
            });
        }

        if (!Array.isArray(parsedFamiliares) || parsedFamiliares.length === 0) {
            return res.status(400).json({
                message: "Se requiere un array valido de familiares"
            });
        }

        if (parsedVehiculos !== undefined && !Array.isArray(parsedVehiculos)) {
            return res.status(400).json({
                message: "vehiculos debe ser un arreglo valido"
            });
        }

        if (parsedNegocios.length > MAX_ITEMS_ARRAY || parsedFamiliares.length > MAX_ITEMS_ARRAY || (parsedVehiculos?.length ?? 0) > MAX_ITEMS_ARRAY) {
            return res.status(400).json({
                message: `Cada arreglo (vehiculos, negocios, familiares) admite maximo ${MAX_ITEMS_ARRAY} elementos`
            });
        }

        if (parsedFamiliares.some((f: any) => !f.relacion)) {
            return res.status(400).json({
                message: "Cada familiar debe incluir el campo relacion"
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
                    curp: curpFile,
                    rfc: rfcFile,
                    ine: ineFile,
                    comprobanteDomicilio: comprobanteFile,
                    direccionId: nuevaDireccion.id
                }
            });

            // Buscar validadores asignados a la misma sucursal
            let validadores = await tx.empleado.findMany({
                where: {
                    sucursalId: empleadoCoordinador.sucursalId,
                    usuario: {
                        rol: {
                            nombre: 'validador'
                        }
                    }
                },
                select: { id: true }
            });

            // Si no hay validadores en esa sucursal, buscar de manera global en el sistema
            if (validadores.length === 0) {
                validadores = await tx.empleado.findMany({
                    where: {
                        usuario: {
                            rol: {
                                nombre: 'validador'
                            }
                        }
                    },
                    select: { id: true }
                });
            }

            let validadorIdAleatorio: number | null = null;
            if (validadores.length > 0) {
                const randomIndex = Math.floor(Math.random() * validadores.length);
                validadorIdAleatorio = validadores[randomIndex].id;
            }

            const presolicitud = await tx.presolicitud.create({
                data: {
                    folio: folioGenerado,
                    personaId: nuevaPersona.id,
                    sucursalId: empleadoCoordinador.sucursalId,
                    validadorId: validadorIdAleatorio,
                    coordinadorId: empleadoCoordinador.id,
                    estado: 'PENDIENTE',
                    correoSolicitante: correo_solicitante
                }
            });

            if (parsedVehiculos && Array.isArray(parsedVehiculos) && parsedVehiculos.length > 0) {
                for (const v of parsedVehiculos) {
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

            for (const n of parsedNegocios) {
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

            for (const f of parsedFamiliares) {
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

            return presolicitud;
        });

        return res.status(201).json({
            message: "Presolicitud creada con exito",
            data: nuevaPresolicitud
        });
    } catch (error: any) {
        console.error("Error al crear la presolicitud: ", error);
        return res.status(500).json({
            message: "Error al crear la presolicitud"
        });
    }
}
//#endregion
//#region Validar Presolicitud
export const validarPresolicitud = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estados_permitidos = ['VALIDADA', 'RECHAZADA'];

    try {
        const idPresolicitud = parseId(id);

        if (!idPresolicitud) {
            return res.status(400).json({
                message: "El ID de la presolicitud no es valido"
            });
        }

        if (!estado || !estados_permitidos.includes(estado)) {
            return res.status(400).json({
                message: 'Estado invalido',
                error: 'El estado debe ser VALIDADA o RECHAZADA'
            });
        }

        const empleadoValidador = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoValidador) {
            return res.status(404).json({
                message: "No se encontro un empleado asociado al usuario en sesion"
            });
        }

        const presolicitudExistente = await prisma.presolicitud.findUnique({
            where: { id: idPresolicitud }
        });

        if (!presolicitudExistente) {
            return res.status(404).json({
                message: "Presolicitud no encontrada"
            });
        }

        if (presolicitudExistente.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: "Esta presolicitud ya fue procesada",
                error: `Estado actual: ${presolicitudExistente.estado}`
            });
        }

        const resultadoTransaccion = await prisma.$transaction(async (tx) => {
            const presolicitudActualizada = await tx.presolicitud.update({
                where: { id: idPresolicitud },
                data: {
                    estado: estado,
                    validadorId: empleadoValidador.id
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
            message: "Error al validar presolicitud"
        });
    }
}
//#region Aprobar
export const aprobarSolicitud = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        estado,
        user_password, user_name
    } = req.body;
    const estadosPermitidos = ['APROBADA', 'RECHAZADA']

    try {
        const idSolicitud = parseId(id);

        if (!idSolicitud) {
            return res.status(400).json({
                message: "El ID de la solicitud no es valido"
            });
        }

        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                message: 'Error al aprobar solicitud',
                error: 'El estado solo puede ser APROBADA o RECHAZADA'
            })
        }

        if (estado === 'APROBADA') {
            if (!user_name || !user_password) {
                return res.status(400).json({
                    message: "user_name y user_password son obligatorios para aprobar la solicitud"
                });
            }

            if (String(user_password).length < PASSWORD_MIN_LENGTH) {
                return res.status(400).json({
                    message: `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
                });
            }
        }

        const empleadoGerente = await prisma.empleado.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!empleadoGerente) {
            return res.status(404).json({
                message: "No se encontro un empleado asociado al usuario en sesion"
            });
        }

        const solicitudExistente = await prisma.solicitud.findUnique({
            where: { id: idSolicitud }
        });

        if (!solicitudExistente) {
            return res.status(404).json({
                message: 'No se encontro la solicitud'
            });
        }

        if (solicitudExistente.estado !== 'PENDIENTE') {
            return res.status(400).json({
                message: "Esta solicitud ya fue procesada",
                error: `Estado actual: ${solicitudExistente.estado}`
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
                    where: { id: idSolicitud },
                    data: {
                        estado: estado,
                        gerenteId: empleadoGerente.id
                    }
                });

                const rolDistribuidora = await tx.rol.findFirst({
                    where: { nombre: 'distribuidora' }
                });

                if (!rolDistribuidora) {
                    throw new Error("No existe el rol 'distribuidora' en el sistema");
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(user_password, salt);

                const usuarioDistribuidora = await tx.usuario.create({
                    data: {
                        email: presolicitudRelacionada.correoSolicitante!,
                        username: user_name,
                        personaId: presolicitudRelacionada.personaId,
                        rolId: rolDistribuidora.id,
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
                where: { id: idSolicitud },
                data: {
                    estado: estado,
                    gerenteId: empleadoGerente.id
                }
            });

            return res.status(200).json({
                message: 'Solicitud rechazada con exito',
                data: solicitudRechazada
            });
        }

    } catch (error: any) {
        console.error("Error al aprobar solicitud: ", error);
        return res.status(500).json({
            message: "Error al aprobar presolicitud"
        });
    }
}
//#endregion
//#region Obtener Presolicitudes
export const getPresolicitudes = async (req: Request, res: Response) => {
    try {
        const { page, limit, estado, sucursal_id, search } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

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
            message: "Error al obtener presolicitudes"
        });
    }
};
//#endregion
//#region Obtener Solis

export const getSolicitudes = async (req: Request, res: Response) => {
    try {
        const { page, limit, estado, gerente_id } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

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
            message: "Error al obtener solicitudes"
        });
    }
};
//#region Detalle Prsocilicitud

export const getPresolicitudDetalle = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idPresolicitud = parseId(id);

        if (!idPresolicitud) {
            return res.status(400).json({
                message: "El ID de la presolicitud no es valido"
            });
        }

        const presolicitud = await prismaRead.presolicitud.findUnique({
            where: { id: idPresolicitud },
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
            message: "Error al obtener el detalle de la presolicitud"
        });
    }
};

//#region Obtener Archivos
export const getArchivoPresolicitud = (req: Request, res: Response) => {
    const rawNombre = req.params.nombreArchivo;
    const nombreSinRuta = Array.isArray(rawNombre) ? rawNombre[0] : rawNombre;

    if (!nombreSinRuta) {
        return res.status(400).json({
            message: 'Nombre de archivo invalido'
        })
    }

    // path.basename descarta cualquier componente de directorio (../, ..\, rutas absolutas)
    // para evitar path traversal fuera de las carpetas de uploads.
    const nombreArchivo = path.basename(nombreSinRuta);

    if (!nombreArchivo || nombreArchivo !== nombreSinRuta) {
        return res.status(400).json({
            message: 'Nombre de archivo invalido'
        })
    }

    const nfsPath = path.join(__dirname, '../../uploads', nombreArchivo);
    const localPath = path.join(__dirname, '../../uploads-fallback', nombreArchivo);

    let filePath = '';

    if (fs.existsSync(nfsPath)) {
        filePath = nfsPath;
    } else if (fs.existsSync(localPath)) {
        filePath = localPath
    } else {
        return res.status(404).json({
            message: 'Archivo no encontrado en el storage ni en respaldo'
        })
    }

    return res.sendFile(filePath);
}