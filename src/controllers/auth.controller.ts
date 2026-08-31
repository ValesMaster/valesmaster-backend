import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma, { prismaRead } from '../lib/prisma';
import { registerAudit } from '../services/audit.service';

//#region Register Test
// ESTE METODO DE REGISTRO ES PARA CREAR USUARIOS PARA PROBAR LAS FASES DE LOGIN
// Deja al usuario (y su Empleado, si el rol lo requiere) listo para intentar
// iniciar sesion desde cero: no crea TotpSecret ni SecurityQuestion, asi que
// el login lo va a mandar por el flujo completo (escanear QR + registrar
// preguntas de seguridad) si su rol requiere 3 factores.
export const registerTest = async (req: Request, res: Response) => {
    try {
        const {
            email, username, password, rolId, sucursal_id,
            nombres, apellidoPaterno, apellidoMaterno, fechaNacimiento,
            genero, curp, rfc, telefono, ine, estado, municipio, colonia,
            codigoPostal, calle, numeroExterior, referencia
        } = req.body;

        if (!email || !username || !password || !rolId || !curp || !rfc) {
            return res.status(400).json({
                message: 'Faltan campos obligatorios'
            });
        }

        const rolExiste = await prisma.rol.findUnique({ where: { id: rolId } });
        if (!rolExiste) {
            return res.status(400).json({
                message: 'El rol especificado no existe'
            })
        }

        // Todos los roles internos (todos menos 'distribuidora') necesitan un
        // Empleado ligado a una sucursal para poder usar el resto de la API.
        const requiereEmpleado = rolExiste.nombre !== 'distribuidora';
        let sucursalIdNum: number | undefined;

        if (requiereEmpleado) {
            sucursalIdNum = Number(sucursal_id);

            if (!sucursal_id || !Number.isInteger(sucursalIdNum)) {
                return res.status(400).json({
                    message: 'sucursal_id es obligatorio y debe ser un numero valido para este rol'
                });
            }

            const sucursalExiste = await prisma.sucursal.findFirst({
                where: { id: sucursalIdNum, deletedAt: null }
            });

            if (!sucursalExiste) {
                return res.status(400).json({
                    message: 'La sucursal especificada no existe'
                });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.$transaction(async (tx) => {
            const usuarioCreado = await tx.usuario.create({
                data: {
                    email,
                    username,
                    password: hashedPassword,
                    rol: {
                        connect: { id: rolId }
                    },
                    persona: {
                        create: {
                            nombre: nombres,
                            apellidoPaterno,
                            apellidoMaterno,
                            fechaNacimiento: new Date(fechaNacimiento),
                            genero,
                            curp,
                            rfc,
                            telefono,
                            ine,
                            direccion: {
                                create: {
                                    estado,
                                    municipio,
                                    colonia,
                                    codigoPostal,
                                    calle,
                                    numeroExterior,
                                    referencia
                                }
                            }
                        }
                    }
                },
                include: {
                    rol: true,
                    persona: true
                }
            });

            if (requiereEmpleado) {
                await tx.empleado.create({
                    data: {
                        sucursalId: sucursalIdNum!,
                        usuarioId: usuarioCreado.id
                    }
                });
            }

            return usuarioCreado;
        });

        registerAudit({
            action: 'REGISTRO_USUARIO',
            module: 'AUTH',
            status: 'SUCCESS',
            req,
            details: {
                usuarioId: newUser.id,
                username: newUser.username,
                email: newUser.email,
                rol: newUser.rol.nombre,
                sucursalId: sucursalIdNum
            }
        });

        return res.status(201).json({
            message: 'Usuario registrado con exito, listo para iniciar sesion (le pedira escanear QR y registrar preguntas de seguridad si su rol lo requiere)',
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                rol: newUser.rol.nombre,
                mfaRequerido: newUser.rol.cantidadMfa,
                sucursalId: sucursalIdNum,
                persona: {
                    nombreCompleto: `${newUser.persona.nombre} ${newUser.persona.apellidoPaterno} ${newUser.persona.apellidoMaterno}`,
                    curp: newUser.persona.curp,
                    rfc: newUser.persona.rfc
                }
            }
        })
    } catch (error: any) {
        console.error('Error en el registro:', error);

        registerAudit({
            action: 'REGISTRO_USUARIO',
            module: 'AUTH',
            status: 'FAILED',
            req,
            details: {
                email: req.body?.email,
                username: req.body?.username,
                error: error.message
            }
        });

        return res.status(500).json({ message: 'Error interno del servidor al registrar el usuario' });
    }
}

//#region Login 1MFA
export const loginPhaseOne = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || '';

    try {
        const user = await prisma.usuario.findUnique({
            where: { email: email, deletedAt: null },
            include: { rol: true }
        });

        if (!user) {
            await prisma.loginAttempt.create({
                data: {
                    emailAttempted: email,
                    factorFailed: 1,
                    success: false,
                    ipAddress,
                    userAgent
                }
            });
            return res.status(401).json({
                message: 'Credenciales invalidas'
            });
        }

        if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
            return res.status(403).json({
                message: 'Esta cuenta esta bloqueada por demasiados intentos',
                bloqueadoHasta: user.bloqueadoHasta
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const nuevosIntentos = user.intentosFallidos + 1;
            const bloqueadoHasta = nuevosIntentos > 5 ? new Date(Date.now() + 15 * 60000) : null;

            await prisma.$transaction([
                prisma.usuario.update({
                    where: { id: user.id },
                    data: { intentosFallidos: nuevosIntentos, bloqueadoHasta }
                }),
                prisma.loginAttempt.create({
                    data: {
                        userId: user.id,
                        emailAttempted: email,
                        factorFailed: 1,
                        success: false,
                        ipAddress,
                        userAgent
                    }
                })

            ]);

            return res.status(401).json({
                message: 'Contrasena incorrecta'
            });
        }

        await prisma.usuario.update({
            where: { id: user.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null, ipUltimoIntento: ipAddress }
        })

        const requerimientosMfa = user.rol.cantidadMfa;

        if (requerimientosMfa === 1) {
            await prisma.loginAttempt.create({
                data: {
                    userId: user.id,
                    emailAttempted: email,
                    factorFailed: 1,
                    success: true,
                    ipAddress,
                    userAgent
                }
            });

            const accessToken = jwt.sign(
                { id: user.id, rol: user.rol.nombre },
                process.env.JWT_SECRET!,
                { expiresIn: '8h' }
            );

            return res.status(200).json({
                step: 'COMPLETED',
                accessToken
            });
        } else {
            const totpConfirmado = await prisma.totpSecret.findFirst({
                where: {
                    userId: user.id,
                    confirmed: true,
                    deletedAt: null
                }
            });

            const mfaToken = jwt.sign(
                { id: user.id, step: 'REQUIRE_TOTP', mfaRequired: requerimientosMfa },
                process.env.JWT_SECRET!,
                { expiresIn: '5m' }
            );

            return res.status(200).json({
                step: 'REQUIRE_TOTP',
                mfaToken,
                totpConfigured: !!totpConfirmado,
                message: 'Por favor ingrese su codigo de autenticacion'
            });
        }
    } catch (error) {
        console.error('Error al iniciar sesion', error);
        return res.status(500).json({
            message: 'Error interno del servidor',
        });
    }
}

//#region Validate Token
export const validateToken = async (req: Request, res: Response) => {
    try {
        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                valid: false,
                message: 'Token requerido'
            });
        }

        const token = auth.split(' ')[1];

        const payload: any = jwt.verify(token, process.env.JWT_SECRET!);

        if (payload.step) {
            return res.status(401).json({
                valid: false,
                message: 'Token inválido'
            });
        }

        const user = await prisma.usuario.findUnique({
            where: { id: payload.id, deletedAt: null },
            include: { rol: true }
        });

        if (!user) {
            return res.status(401).json({
                valid: false,
                message: 'Token inválido'
            });
        }

        return res.status(200).json({
            valid: true,
            id: user.id,
            rol: user.rol.nombre
        });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                valid: false,
                message: 'El token expiró'
            });
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                valid: false,
                message: 'Token inválido'
            });
        }

        console.error('Error al validar token', error);
        return res.status(500).json({
            message: 'Error interno del servidor'
        });
    }
}

export const obtenerRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prismaRead.rol.findMany({
            select: {
                nombre: true,
                id: true
            }
        });

        if (!roles) {
            return res.status(404).json({
                message: 'No se encontraron los roles'
            });
        }

        return res.status(200).json({
            message: 'Roles obtenidos con exito',
            data: roles
        });
    } catch {
        return res.status(500).json({
            message: 'No se pudo obtener los roles'
        });
    }
}