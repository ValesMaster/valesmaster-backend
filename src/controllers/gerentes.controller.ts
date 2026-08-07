import { Request, Response } from 'express';
import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

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

// #endregion
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

// #endregion
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

        return res.status(200).json({
            message: 'Empleado creado exitosamente',
            data: creacionEmpleado
        })
    } catch (error: any) {
        console.error('Error al crear empleado:', error);

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

// #endregion

@Controller('api/gerentes')
export class GerentesController {
    @Get('consultar/empleados')
    obtenerEmpleados(@Req() req: Request, @Res() res: Response) {
        return obtenerEmpleadosFiltrados(req, res);
    }

    @Get('obtener/empleado/:id')
    obtenerEmpleado(@Req() req: Request, @Res() res: Response) {
        return obtenerDetalleEmpleado(req, res);
    }

    @Post('crear/empleado')
    crear(@Req() req: Request, @Res() res: Response) {
        return crearEmpleado(req, res);
    }
}
