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