import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

// ESTE METODO DE REGISTRO ES PARA CREAR USUARIOS PARA PROBAR LAS FASES DE LOGIN
export const registerTest = async (req: Request, res: Response) => {
    try {
        const {
            email, username, password, rolId,
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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.usuario.create({
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

        return res.status(201).json({
            message: 'Usuario registrado correctemente',
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                rol: newUser.rol.nombre,
                mfaRequerido: newUser.rol.cantidadMfa,
                persona: {
                    nombreCompleto: `${newUser.persona.nombre} ${newUser.persona.apellidoPaterno} ${newUser.persona.apellidoMaterno}`,
                    curp: newUser.persona.curp,
                    rfc: newUser.persona.rfc
                }
            }
        })
    } catch (error: any) {
        console.error('Error en el registro:', error);

        if (error.code === 'P2002') {
            const target = error.meta?.target;
            const fields = Array.isArray(target) ? target.join(', ') : 'desconocido';

            return res.status(409).json({
                message: `Error de duplicidad: El campo (${fields}) ya está registrado en el sistema.`
            });
        }

        return res.status(500).json({ message: 'Error interno del servidor al registrar el usuario' });
    }
}

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
            const mfaToken = jwt.sign(
                { id: user.id, step: 'REQUIRE_TOTP', mfaRequired: requerimientosMfa },
                process.env.JWT_SECRET!,
                { expiresIn: '5m' }
            );

            return res.status(200).json({
                step: 'REQUIRE_TOTP',
                mfaToken,
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