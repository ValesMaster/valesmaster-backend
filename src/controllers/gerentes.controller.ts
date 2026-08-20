import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { registerAudit } from '../services/audit.service';


// #region Obtiene empleados
export const obtenerEmpleadosFiltrados = async (req: Request, res: Response) => {
    try {
        const { roles, sucursalId, page = 1, limit = 10, search } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const whereClause: any = {
            activo: true,
            ...(roles && {
                rolId: {
                    in: (roles as string).split(',').map(id => Number(id))
                }
            }),

            ...(sucursalId && {
                empleados: {
                    some: {
                        sucursalId: Number(sucursalId)
                    }
                }
            }),
        };

        const [usuarios, totalRegistros] = await Promise.all([
            prisma.usuario.findMany({
                where: whereClause,
                skip: skip,
                take: pageSize,
                include: {
                    rol: true,
                    persona: true,
                    empleados: {
                        include: {
                            sucursal: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.usuario.count({ where: whereClause })
        ]);

        return res.status(200).json({
            success: true,
            data: usuarios,
            pagination: {
                total: totalRegistros,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(totalRegistros / pageSize)
            }
        });

    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        return res.status(500).json({
            message: 'Ocurrió un error interno en el servidor',
            error: error instanceof Error ? error.message : error
        });
    }
};

// #region Detalle empleado

export const obtenerDetalleEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const empladoExistente = await prisma.usuario.findUnique({
            where: { id: Number(id) },
            include: {
                rol: true,
                persona: {
                    include: {
                        direccion: true
                    }
                },
                empleados: {
                    include: {
                        sucursal: true
                    }
                }
            }
        });

        if (!empladoExistente) {
            return res.status(404).json({
                message: 'Empleado no encontrado'
            });
        }

        if (empladoExistente.activo != true) {
            return res.status(400).json({
                message: 'Este empleado no esta activo en el sistema'
            });
        }

        return res.status(200).json({
            message: 'Empleado consultado con exito',
            data: empladoExistente
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al obtener el detalle del empleado',
            error: error.message
        });
    }
}

// #region Crear empleado

export const crearEmpleado = async (req: Request, res: Response) => {
    const {
        nombre, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, genero,
        estado, municipio, codigo_postal, colonia, calle, numero_exterior, numero_interior, referencia,
        rol_id, username, email, password, sucursal_id
    } = req.body;

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const creacionEmpleado = await prisma.$transaction(async (tx) => {
            const rolEncontrado = await tx.rol.findUnique({
                where: { id: Number(rol_id) }
            });

            if (!rolEncontrado) {
                throw new Error('El rol especificado no existe');
            }

            const direccionCreada = await tx.direccion.create({
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

            const personaCreada = await tx.persona.create({
                data: {
                    nombre,
                    apellidoPaterno: apellido_paterno,
                    apellidoMaterno: apellido_materno,
                    fechaNacimiento: fecha_nacimiento,
                    telefono,
                    genero,
                    direccionId: direccionCreada.id
                }
            });

            const usuarioCreado = await tx.usuario.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    rolId: Number(rol_id),
                    activo: true,
                    personaId: personaCreada.id,
                    intentosFallidos: 0,
                    bloqueadoHasta: null,
                    ipUltimoIntento: null
                }
            });

            const empleadoCreado = await tx.empleado.create({
                data: {
                    sucursalId: sucursal_id,
                    usuarioId: usuarioCreado.id
                },
                include: {
                    usuario: {
                        include: {
                            persona: true,
                            rol: true
                        }
                    },
                    sucursal: true
                }
            });

            return { empleadoCreado, rolNombre: rolEncontrado.nombre, cantidadMfa: rolEncontrado.cantidadMfa }
        });

        registerAudit({
            action: 'CREAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'SUCCESS',
            req,
            details: {
                empleadoId: creacionEmpleado.empleadoCreado.id,
                usuarioId: creacionEmpleado.empleadoCreado.usuarioId,
                username,
                email,
                sucursalId: sucursal_id,
                rolId: rol_id,
                rolNombre: creacionEmpleado.rolNombre
            }
        });

        return res.status(200).json({
            message: 'Empleado creado exitosamente',
            data: creacionEmpleado
        })
    } catch (error: any) {
        console.error('Error al crear empleado:', error);

        registerAudit({
            action: 'CREAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'FAILED',
            req,
            details: {
                username: req.body?.username,
                email: req.body?.email,
                sucursalId: req.body?.sucursal_id,
                rolId: req.body?.rol_id,
                error: error.message
            }
        });

        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: `El registro ya existe en el sistema (conflicto en campo único): ${error.meta?.target}`
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Ocurrió un error interno al registrar el empleado'
        });
    }
}

// #region Desactivar Empleado

export const desactivarEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const empleadoExistente = await prisma.usuario.findUnique({
            where: { id: Number(id) }
        });

        if (!empleadoExistente) {
            return res.status(500).json({
                message: 'Empleado no encontrado',
            });
        }

        const empleadoDesactivado = await prisma.usuario.update({
            where: { id: Number(id) },
            data: {
                activo: false,
                updatedAt: new Date(),
                deletedAt: new Date()
            },
            include: {
                persona: true,
                rol: true,
                empleados: {
                    include: {
                        sucursal: true
                    }
                }
            }
        });

        registerAudit({
            action: 'DESACTIVAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'SUCCESS',
            req,
            details: {
                usuarioId: Number(id),
                username: empleadoExistente.username,
                email: empleadoExistente.email
            }
        });


        return res.status(200).json({
            message: 'Empleado desactivado correctamente',
            data: empleadoDesactivado
        })
    } catch (error: any) {

        registerAudit({
            action: 'DESACTIVAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'FAILED',
            req,
            details: {
                usuarioId: Number(id),
                error: error.message
            }
        });

        return res.status(500).json({
            message: 'Error al desactivar empleado',
            error: error.message
        });
    }
}

//#region Modificar Empleado

export const modificarEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    try {
        const usuarioExistente = await prisma.usuario.findUnique({
            where: { id: Number(id) },
            include: {
                persona: {
                    include: { direccion: true }
                },
                empleados: true
            }
        });

        if (!usuarioExistente) {
            return res.status(404).json({
                message: 'Empleado no encontrado'
            });
        }

        const empleadoActualizado = await prisma.$transaction(async (tx) => {
            const direccionData: any = {};
            if (body.estado !== undefined) direccionData.estado = body.estado;
            if (body.municipio !== undefined) direccionData.municipio = body.municipio;
            if (body.codigo_postal !== undefined) direccionData.codigoPostal = body.codigo_postal;
            if (body.colonia !== undefined) direccionData.colonia = body.colonia;
            if (body.calle !== undefined) direccionData.calle = body.calle;
            if (body.numero_exterior !== undefined) direccionData.numeroExterior = body.numero_exterior;
            if (body.numero_interior !== undefined) direccionData.numeroInterior = body.numero_interior;
            if (body.referencia !== undefined) direccionData.referencia = body.referencia;

            if (Object.keys(direccionData).length > 0 && usuarioExistente.persona?.direccionId) {
                await tx.direccion.update({
                    where: { id: usuarioExistente.persona.direccionId },
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

            if (Object.keys(personaData).length > 0 && usuarioExistente.personaId) {
                await tx.persona.update({
                    where: { id: usuarioExistente.personaId },
                    data: personaData
                });
            }

            if (body.sucursal_id !== undefined && usuarioExistente.empleados.length > 0) {
                const empleadoId = usuarioExistente.empleados[0].id;
                await tx.empleado.update({
                    where: { id: empleadoId },
                    data: { sucursalId: Number(body.sucursal_id) }
                });
            }

            return await tx.usuario.findUnique({
                where: { id: Number(id) },
                include: {
                    rol: true,
                    persona: {
                        include: { direccion: true }
                    },
                    empleados: {
                        include: { sucursal: true }
                    }
                }
            });
        });

        registerAudit({
            action: 'MODIFICAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'SUCCESS',
            req,
            details: {
                usuarioId: Number(id),
                username: usuarioExistente.username,
                cambios: body
            }
        });

        return res.status(200).json({
            message: "Empleado actualizado con éxito",
            data: empleadoActualizado
        });

    } catch (error: any) {
        console.error('Error al modificar empleado:', error);

        registerAudit({
            action: 'MODIFICAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'FAILED',
            req,
            details: {
                usuarioId: Number(id),
                cambios: body,
                error: error.message
            }
        });
        return res.status(500).json({
            message: 'Error al modificar al empleado',
            error: error.message
        });
    }
}

//#region Obtener Selector Sucursales

export const obtenerSucursalesSelector = async (req: Request, res: Response) => {
    try {
        const sucursales = await prisma.sucursal.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                nombre: true
            }
        });

        if (!sucursales) {
            return res.status(404).json({
                message: 'No se encontraron sucursales'
            });
        }

        return res.status(200).json({
            message: 'Sucursales obtenidas con exito',
            data: sucursales
        });
    } catch (error: any) {
        return res.status(500).json({
            message: 'Error al obtener sucursales',
            error: error.message
        });
    }
}