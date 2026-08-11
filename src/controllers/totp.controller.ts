import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import prisma from "../lib/prisma";

import {
    generateRecoveryCodes,
    generateTotpSecret,
    verifyTotp
} from "../services/totp.service";
import { respondJwtError } from "../utils/jwtErrors";

export const setupTotp = async (
    req: Request,
    res: Response
) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                message: "Token requerido"
            });
        }

        const token = auth.split(" ")[1];

        const payload: any = jwt.verify(
            token,
            process.env.JWT_SECRET!
        );

        if (payload.step && payload.step !== "REQUIRE_TOTP") {
            return res.status(401).json({
                message: "Token inválido."
            });
        }

        const user = await prisma.usuario.findUnique({
            where: {
                id: payload.id
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "Usuario no encontrado"
            });
        }

        const confirmed = await prisma.totpSecret.findFirst({
            where: {
                userId: user.id,
                confirmed: true,
                deletedAt: null
            }
        });

        if (confirmed) {
            return res.status(409).json({
                message: "El usuario ya tiene TOTP configurado."
            });
        }

        await prisma.totpSecret.deleteMany({
            where: {
                userId: user.id,
                confirmed: false
            }
        });

        const secret = generateTotpSecret(user.email);

        const recoveryCodes = generateRecoveryCodes();

        const newSecret = await prisma.totpSecret.create({
            data: {
                userId: user.id,
                secretEncrypted: secret.base32,
                recoveryCodes: recoveryCodes.join(","),
                confirmed: false
            }
        });

        const qr = await QRCode.toDataURL(
            secret.otpauth_url!
        );

        return res.json({
            qr,
            secret: secret.base32,
            secretId: newSecret.id
        });

    } catch (error) {

        console.error(error);

        const jwtResponse = respondJwtError(res, error);
        if (jwtResponse) return jwtResponse;

        return res.status(500).json({
            message: "Error interno"
        });

    }

};

export const enableTotp = async (
    req: Request,
    res: Response
) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                message: "Token requerido"
            });
        }

        const token = auth.split(" ")[1];

        const payload: any = jwt.verify(
            token,
            process.env.JWT_SECRET!
        );

        if (payload.step && payload.step !== "REQUIRE_TOTP") {
            return res.status(401).json({
                message: "Token inválido."
            });
        }

        const { code } = req.body;

        if (!code || typeof code !== "string") {
            return res.status(400).json({
                message: "El código es obligatorio."
            });
        }

        const secret = await prisma.totpSecret.findFirst({

            where: {

                userId: payload.id,

                confirmed: false,

                deletedAt: null

            },

            orderBy: {

                createdAt: "desc"

            }

        });

        if (!secret) {

            return res.status(404).json({
                message: "No existe un TOTP pendiente."
            });

        }

        const valid = verifyTotp(
            secret.secretEncrypted,
            code
        );

        if (!valid) {

            return res.status(400).json({
                message: "Código incorrecto."
            });

        }

        await prisma.$transaction([

            prisma.totpSecret.update({

                where: {
                    id: secret.id
                },

                data: {
                    confirmed: true
                }

            }),

            prisma.totpSecret.deleteMany({

                where: {

                    userId: payload.id,

                    confirmed: false,

                    id: {
                        not: secret.id
                    }

                }

            })

        ]);

        return res.json({

            message: "TOTP configurado correctamente."

        });

    } catch (error) {

        console.error(error);

        const jwtResponse = respondJwtError(res, error);
        if (jwtResponse) return jwtResponse;

        return res.status(500).json({

            message: "Error interno"

        });

    }

};

export const verifyTotpLogin = async (
    req: Request,
    res: Response
) => {

    try {

        const {
            mfaToken,
            code
        } = req.body;

        if (!mfaToken || !code) {
            return res.status(400).json({
                message: "El token y el código son obligatorios."
            });
        }

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_TOTP") {

            return res.status(401).json({
                message: "Token inválido."
            });

        }

        const user = await prisma.usuario.findUnique({

            where: {
                id: payload.id
            },

            include: {
                rol: true
            }

        });

        if (!user) {

            return res.status(404).json({
                message: "Usuario no encontrado."
            });

        }

        const secret = await prisma.totpSecret.findFirst({

            where: {

                userId: user.id,

                confirmed: true,

                deletedAt: null

            },

            orderBy: {

                createdAt: "desc"

            }

        });

        if (!secret) {

            return res.status(400).json({
                message: "El usuario no tiene TOTP configurado."
            });

        }

        const valid = verifyTotp(
            secret.secretEncrypted,
            code
        );

        if (!valid) {

            await prisma.loginAttempt.create({

                data: {

                    userId: user.id,

                    emailAttempted: user.email,

                    factorFailed: 2,

                    success: false,

                    ipAddress: req.ip || "",

                    userAgent: req.headers["user-agent"] || ""

                }

            });

            return res.status(401).json({

                message: "Código TOTP incorrecto."

            });

        }

        await prisma.loginAttempt.create({

            data: {

                userId: user.id,

                emailAttempted: user.email,

                factorFailed: 2,

                success: true,

                ipAddress: req.ip || "",

                userAgent: req.headers["user-agent"] || ""

            }

        });

        if (user.rol.cantidadMfa === 2) {

            const accessToken = jwt.sign(

                {
                    id: user.id,
                    rol: user.rol.nombre
                },

                process.env.JWT_SECRET!,

                {
                    expiresIn: "8h"
                }

            );

            return res.json({

                step: "COMPLETED",

                accessToken

            });

        }

        const securityToken = jwt.sign(

            {
                id: user.id,
                step: "REQUIRE_SECURITY"
            },

            process.env.JWT_SECRET!,

            {
                expiresIn: "5m"
            }

        );

        return res.json({

            step: "REQUIRE_SECURITY",

            mfaToken: securityToken,

            message: "Responda las preguntas de seguridad."

        });

    } catch (error) {

        console.error(error);

        const jwtResponse = respondJwtError(res, error);
        if (jwtResponse) return jwtResponse;

        return res.status(500).json({

            message: "Error interno."

        });

    }

};