import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import {
    generateEmailCode,
    sendLoginCode
} from "../services/email.service";

export const sendEmailCode = async (
    req: Request,
    res: Response
) => {

    try {

        const { mfaToken } = req.body;

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_EMAIL") {
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
                message: "Usuario no encontrado."
            });
        }

        await prisma.emailVerificationCode.updateMany({
            where: {
                userId: user.id,
                used: false
            },
            data: {
                used: true
            }
        });

        const code = generateEmailCode();

        await prisma.emailVerificationCode.create({
            data: {
                userId: user.id,
                code,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            }
        });

        await sendLoginCode(
            user.email,
            code
        );

        return res.json({
            message: "Código enviado correctamente."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message: "Error interno."
        });

    }

};

export const verifyEmailCode = async (
    req: Request,
    res: Response
) => {

    try {

        const {
            mfaToken,
            code
        } = req.body;

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_EMAIL") {
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

        const verification = await prisma.emailVerificationCode.findFirst({
            where: {
                userId: user.id,
                code,
                used: false,
                deletedAt: null
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if (!verification) {

            await prisma.loginAttempt.create({
                data: {
                    userId: user.id,
                    emailAttempted: user.email,
                    factorFailed: 3,
                    success: false,
                    ipAddress: req.ip || "",
                    userAgent: req.headers["user-agent"] || ""
                }
            });

            return res.status(401).json({
                message: "Código incorrecto."
            });

        }

        if (verification.expiresAt < new Date()) {
            return res.status(401).json({
                message: "El código expiró."
            });
        }

        await prisma.$transaction([

            prisma.emailVerificationCode.update({
                where: {
                    id: verification.id
                },
                data: {
                    used: true
                }
            }),

            prisma.loginAttempt.create({
                data: {
                    userId: user.id,
                    emailAttempted: user.email,
                    factorFailed: 3,
                    success: true,
                    ipAddress: req.ip || "",
                    userAgent: req.headers["user-agent"] || ""
                }
            })

        ]);

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

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message: "Error interno."
        });

    }

};