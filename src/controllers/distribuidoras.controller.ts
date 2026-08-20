import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { registerAudit } from "../services/audit.service";

//#region Obtener Perfil
export const obtenerPerfil = async (req: Request, res: Response) => {
    const { id } = req.body;
    try {
        const distribuidora = await prisma.distribuidora.findUnique({
            where: { id: id },
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

//#region Obtener Clientes
export const obtenerClientes = async (req: Request, res: Response) => {
    const { id_distribuidora } = req.body;
    try {
        const clientes = await prisma.cliente.findMany({
            where: { distribuidoraId: id_distribuidora },
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
        estado, municipio, codigo_postal, colonia, calle, numero_exterior, numero_interior, referencia,
        distribuidora_id
    } = req.body
    try {
        const distribuidoraExistente = await prisma.distribuidora.findUnique({
            where: { id: distribuidora_id }
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
        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: Number(id) },
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
        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: Number(id) },
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
            if (body.fecha_nacimiento !== undefined) personaData.fechaNacimiento = body.fecha_nacimiento;
            if (body.telefono !== undefined) personaData.telefono = body.telefono;
            if (body.genero !== undefined) personaData.genero = body.genero;

            if (Object.keys(personaData).length > 0 && clienteExistente.personaId) {
                await tx.persona.update({
                    where: { id: clienteExistente.personaId },
                    data: personaData
                });
            }

            return await tx.cliente.findUnique({
                where: { id: Number(id) },
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
            message: 'Error al modificar cliente',
            error: error.message
        });
    }
}

//#region Soft Delete Cliente
export const eliminarCliente = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const clienteExistente = await prisma.cliente.findUnique({
            where: { id: Number(id) },
        });

        if (!clienteExistente) {
            return res.status(404).json({
                message: 'Cliente no encontrado'
            });
        }

        const clienteDesactivado = await prisma.cliente.update({
            where: { id: Number(clienteExistente.id) },
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