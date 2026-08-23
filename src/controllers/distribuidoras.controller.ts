import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { registerAudit } from "../services/audit.service";
import { parseId, parsePagination } from "../utils/validation";

//#region Obtener Perfil
export const obtenerPerfil = async (req: Request, res: Response) => {
    try {
        const distribuidora = await prisma.distribuidora.findFirst({
            where: { usuarioId: req.user!.id },
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

//#region Obtener Distribuidoras
export const obtenerDistribuidoras = async (req: Request, res: Response) => {
    try {
        const { page, limit, categoria, sucursal_id, search } = req.query;

        const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

        const whereClause: any = {};

        if (categoria) {
            whereClause.categoria = String(categoria);
        }

        if (sucursal_id) {
            whereClause.sucursalId = Number(sucursal_id);
        }

        if (search) {
            whereClause.usuario = {
                OR: [
                    { username: { contains: String(search), mode: 'insensitive' } },
                    { email: { contains: String(search), mode: 'insensitive' } },
                    { persona: { nombre: { contains: String(search), mode: 'insensitive' } } }
                ]
            };
        }

        const [distribuidoras, total] = await Promise.all([
            prisma.distribuidora.findMany({
                where: whereClause,
                skip,
                take: limitNumber,
                include: {
                    usuario: {
                        select: {
                            username: true,
                            email: true,
                            persona: { select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true } }
                        }
                    },
                    sucursal: { select: { id: true, nombre: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.distribuidora.count({ where: whereClause })
        ]);

        return res.status(200).json({
            message: "Distribuidoras obtenidas con exito",
            data: distribuidoras,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error: any) {
        console.error("Error al obtener distribuidoras: ", error);
        return res.status(500).json({
            message: "Error al obtener distribuidoras"
        });
    }
}
//#endregion

//#region Obtener Clientes
export const obtenerClientes = async (req: Request, res: Response) => {
    const { id_distribuidora } = req.body;
    try {
        let distribuidoraId: number | undefined;

        if (req.user!.rol === 'distribuidora') {
            const distribuidoraPropia = await prisma.distribuidora.findFirst({
                where: { usuarioId: req.user!.id }
            });

            if (!distribuidoraPropia) {
                return res.status(404).json({
                    message: 'No se encontro una distribuidora asociada al usuario en sesion'
                });
            }

            distribuidoraId = distribuidoraPropia.id;
        } else {
            const idDistribuidora = parseId(id_distribuidora);

            if (!idDistribuidora) {
                return res.status(400).json({
                    message: 'id_distribuidora es obligatorio y debe ser un numero valido'
                });
            }

            distribuidoraId = idDistribuidora;
        }

        const clientes = await prisma.cliente.findMany({
            where: { distribuidoraId },
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

//#region Crear Cliente

export const crearCliente = async (req: Request, res: Response) => {
    const {
        nombre, apellido_paterno, apellido_materno, telefono, genero,
        estado, municipio, codigo_postal, colonia, calle, numero_exterior, numero_interior, referencia
    } = req.body
    try {
        if (!nombre || !apellido_paterno || !estado || !municipio || !codigo_postal || !colonia || !calle || !numero_exterior) {
            return res.status(400).json({
                message: 'nombre, apellido_paterno, estado, municipio, codigo_postal, colonia, calle y numero_exterior son obligatorios'
            });
        }

        const distribuidoraExistente = await prisma.distribuidora.findFirst({
            where: { usuarioId: req.user!.id }
        });

        if (!distribuidoraExistente) {
            return res.status(404).json({
                message: 'Distribuidora no encontrada',
            })
        }

        const creacionCliente = await prisma.$transaction(async (tx) => {
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
                    telefono,
                    genero,
                    direccionId: nuevaDireccion.id
                }
            });

            const nuevoCliente = await prisma.cliente.create({
                data: {
                    distribuidoraId: distribuidoraExistente.id,
                    personaId: nuevaPersona.id,
                    estado: 'ACTIVO',

                }
            });

            return { nuevoCliente, nombre: nuevaPersona.nombre }
        });

                registerAudit({
            action: 'CREAR_CLIENTE',
            module: 'CLIENTES',
            status: 'SUCCESS',
            req,
            details: {
                clienteId: creacionCliente.nuevoCliente.id,
                distribuidoraId: distribuidoraExistente.id,
                nombre: creacionCliente.nombre
            }
        });

        return res.status(201).json({
            message: 'Cliente creado con exito',
            data: creacionCliente
        });
    } catch (error: any) {

                registerAudit({
            action: 'CREAR_CLIENTE',
            module: 'CLIENTES',
            status: 'FAILED',
            req,
            details: {
                distribuidoraId: req.body?.distribuidora_id,
                nombre: req.body?.nombre,
                error: error.message
            }
        });
        
        res.status(500).json({
            message: 'Error al crear cliente'
        });
    }
}

//#region Detalle Cliente
export const obtenerDetalleCliente = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idCliente = parseId(id);

        if (!idCliente) {
            return res.status(400).json({
                message: 'El ID del cliente no es valido'
            });
        }

        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: idCliente },
            include: {
                persona: true
            }
        });

        if (!clienteExistente) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        return res.status(200).json({
            message: 'Cliente obtenido con exito',
            data: clienteExistente
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error consultando al cliente'
        });
    }
}

//#region Modificar Cliente
export const modificarCliente = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    try {
        const idCliente = parseId(id);

        if (!idCliente) {
            return res.status(400).json({
                message: 'El ID del cliente no es valido'
            });
        }

        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: idCliente },
            include: {
                persona: {
                    include: {
                        direccion: true
                    }
                }
            }
        });

        if (!clienteExistente) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        const clienteActualizado = await prisma.$transaction(async (tx) => {
            const direccionData: any = {};
            if (body.estado !== undefined) direccionData.estado = body.estado;
            if (body.municipio !== undefined) direccionData.municipio = body.municipio;
            if (body.codigo_postal !== undefined) direccionData.codigoPostal = body.codigo_postal;
            if (body.colonia !== undefined) direccionData.colonia = body.colonia;
            if (body.calle !== undefined) direccionData.calle = body.calle;
            if (body.numero_exterior !== undefined) direccionData.numeroExterior = body.numero_exterior;
            if (body.numero_interior !== undefined) direccionData.numeroInterior = body.numero_interior;
            if (body.referencia !== undefined) direccionData.referencia = body.referencia;

            if (Object.keys(direccionData).length > 0 && clienteExistente.persona?.direccionId) {
                await tx.direccion.update({
                    where: { id: clienteExistente.persona.direccionId },
                    data: direccionData
                });
            }

            const personaData: any = {};
            if (body.nombre !== undefined) personaData.nombre = body.nombre;
            if (body.apellido_paterno !== undefined) personaData.apellidoPaterno = body.apellido_paterno;
            if (body.apellido_materno !== undefined) personaData.apellidoMaterno = body.apellido_materno;
            if (body.fecha_nacimiento !== undefined) personaData.fechaNacimiento = new Date(body.fecha_nacimiento);
            if (body.telefono !== undefined) personaData.telefono = body.telefono;
            if (body.genero !== undefined) personaData.genero = body.genero;

            if (Object.keys(personaData).length > 0 && clienteExistente.personaId) {
                await tx.persona.update({
                    where: { id: clienteExistente.personaId },
                    data: personaData
                });
            }

            return await tx.cliente.findUnique({
                where: { id: idCliente },
                include: {
                    persona: {
                        include: { direccion: true }
                    }
                }
            });
        });

        return res.status(200).json({
            message: 'Cliente actualizado con exito',
            data: clienteActualizado
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al modificar cliente'
        });
    }
}

//#region Soft Delete Cliente
export const eliminarCliente = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const idCliente = parseId(id);

        if (!idCliente) {
            return res.status(400).json({
                message: 'El ID del cliente no es valido'
            });
        }

        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: idCliente },
        });

        if (!clienteExistente) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        if (clienteExistente.estado === 'INACTIVO') {
            return res.status(400).json({
                message: 'Este cliente ya se encuentra desactivado'
            });
        }

        const clienteDesactivado = await prisma.cliente.update({
            where: { id: clienteExistente.id },
            data: {
                estado: 'INACTIVO',
                updatedAt: new Date(),
                deletedAt: new Date()
            }
        });

        return res.status(200).json({
            message: 'Cliente desactivado correctamente',
            data: clienteDesactivado
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al desactivar al cliente'
        })
    }
}