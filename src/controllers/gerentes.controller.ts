import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma, { prismaRead } from '../lib/prisma';
import { registerAudit } from '../services/audit.service';
import { parseId, parsePagination } from '../utils/validation';

const ROLES_NO_EMPLEADO = ['distribuidora'];
const PASSWORD_MIN_LENGTH = 8;

// #region Obtiene empleados
export const obtenerEmpleadosFiltrados = async (req: Request, res: Response) => {
    try {
        const { roles, sucursalId, page, limit, search } = req.query;

        const { pageNumber, limitNumber: pageSize, skip } = parsePagination(page, limit);

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
            prismaRead.usuario.findMany({
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
            prismaRead.usuario.count({ where: whereClause })
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
            message: 'Ocurrió un error interno en el servidor'
        });
    }
};

// #region Detalle empleado

export const obtenerDetalleEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const idEmpleado = parseId(id);

        if (!idEmpleado) {
            return res.status(400).json({
                message: 'El ID del empleado no es valido'
            });
        }

        const empladoExistente = await prismaRead.usuario.findUnique({
            where: { id: idEmpleado },
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
            message: 'Error al obtener el detalle del empleado'
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
        if (!nombre || !apellido_paterno || !rol_id || !username || !email || !password || !sucursal_id) {
            return res.status(400).json({
                message: 'nombre, apellido_paterno, rol_id, username, email, password y sucursal_id son obligatorios'
            });
        }

        if (String(password).length < PASSWORD_MIN_LENGTH) {
            return res.status(400).json({
                message: `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
            });
        }

        const rolIdNum = Number(rol_id);
        const sucursalIdNum = Number(sucursal_id);

        if (!Number.isInteger(rolIdNum) || !Number.isInteger(sucursalIdNum)) {
            return res.status(400).json({
                message: 'rol_id y sucursal_id deben ser numeros validos'
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const creacionEmpleado = await prisma.$transaction(async (tx) => {
            const rolEncontrado = await tx.rol.findUnique({
                where: { id: rolIdNum }
            });

            if (!rolEncontrado) {
                throw new Error('El rol especificado no existe');
            }

            if (ROLES_NO_EMPLEADO.includes(rolEncontrado.nombre)) {
                throw new Error(`El rol '${rolEncontrado.nombre}' no puede asignarse a un empleado interno`);
            }

            const sucursalEncontrada = await tx.sucursal.findFirst({
                where: { id: sucursalIdNum, deletedAt: null }
            });

            if (!sucursalEncontrada) {
                throw new Error('La sucursal especificada no existe');
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
                    fechaNacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
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
                    rolId: rolIdNum,
                    activo: true,
                    personaId: personaCreada.id,
                    intentosFallidos: 0,
                    bloqueadoHasta: null,
                    ipUltimoIntento: null
                }
            });

            const empleadoCreado = await tx.empleado.create({
                data: {
                    sucursalId: sucursalIdNum,
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

        const mensajesValidacion = [
            'El rol especificado no existe',
            'La sucursal especificada no existe'
        ];

        if (mensajesValidacion.includes(error.message) || error.message?.startsWith("El rol '")) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Ocurrió un error interno al registrar el empleado'
        });
    }
}

// #region Desactivar Empleado

export const desactivarEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const idEmpleado = parseId(id);

        if (!idEmpleado) {
            return res.status(400).json({
                message: 'El ID del empleado no es valido'
            });
        }

        const empleadoExistente = await prisma.usuario.findUnique({
            where: { id: idEmpleado }
        });

        if (!empleadoExistente) {
            return res.status(404).json({
                message: 'Empleado no encontrado',
            });
        }

        if (!empleadoExistente.activo) {
            return res.status(400).json({
                message: 'Este empleado ya se encuentra desactivado'
            });
        }

        const empleadoDesactivado = await prisma.$transaction(async (tx) => {
            const usuarioActualizado = await tx.usuario.update({
                where: { id: idEmpleado },
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

            await tx.empleado.updateMany({
                where: { usuarioId: idEmpleado },
                data: { deletedAt: new Date() }
            });

            return usuarioActualizado;
        });

        registerAudit({
            action: 'DESACTIVAR_EMPLEADO',
            module: 'EMPLEADOS',
            status: 'SUCCESS',
            req,
            details: {
                usuarioId: idEmpleado,
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
            message: 'Error al desactivar empleado'
        });
    }
}

//#region Modificar Empleado

export const modificarEmpleado = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    try {
        const idEmpleado = parseId(id);

        if (!idEmpleado) {
            return res.status(400).json({
                message: 'El ID del empleado no es valido'
            });
        }

        const usuarioExistente = await prisma.usuario.findUnique({
            where: { id: idEmpleado },
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

        if (!usuarioExistente.activo) {
            return res.status(400).json({
                message: 'Este empleado esta desactivado, no se puede modificar'
            });
        }

        if (body.sucursal_id !== undefined) {
            const sucursalIdNum = Number(body.sucursal_id);

            if (!Number.isInteger(sucursalIdNum)) {
                return res.status(400).json({
                    message: 'sucursal_id debe ser un numero valido'
                });
            }

            const sucursalEncontrada = await prisma.sucursal.findFirst({
                where: { id: sucursalIdNum, deletedAt: null }
            });

            if (!sucursalEncontrada) {
                return res.status(404).json({
                    message: 'La sucursal especificada no existe'
                });
            }
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
            if (body.fecha_nacimiento !== undefined) personaData.fechaNacimiento = new Date(body.fecha_nacimiento);
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
                where: { id: idEmpleado },
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
                usuarioId: idEmpleado,
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
            message: 'Error al modificar al empleado'
        });
    }
}

//#region Obtener Selector Sucursales

export const obtenerSucursalesSelector = async (req: Request, res: Response) => {
    try {
        const sucursales = await prismaRead.sucursal.findMany({
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
            message: 'Error al obtener sucursales'
        });
    }
}