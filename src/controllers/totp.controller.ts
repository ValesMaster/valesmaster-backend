import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import prisma from "../lib/prisma";
import {
    generateRecoveryCodes,
    generateTotpSecret,
    verifyTotp
} from "../services/totp.service";

export const setupTotp = async (req: Request, res: Response) => {

    try {

        const auth = req.headers.authorization;

        if (!auth)
            return res.status(401).json({
                message: "Token requerido"
            });

        const token = auth.split(" ")[1];

        const payload: any = jwt.verify(
            token,
            process.env.JWT_SECRET!
        );

        const user = await prisma.usuario.findUnique({
            where: {
                id: payload.id
            }
        });

        if (!user)
            return res.status(404).json({
                message: "Usuario no encontrado"
            });

        const secret = generateTotpSecret(user.email);

        const recoveryCodes = generateRecoveryCodes();

        await prisma.totpSecret.create({
            data: {
                userId: user.id,
                secretEncrypted: secret.base32,
                recoveryCodes: recoveryCodes.join(',')
            }
        });

        const qr = await QRCode.toDataURL(secret.otpauth_url!);

        return res.json({
            qr,
            secret: secret.base32
        });

    } catch {

        return res.status(500).json({
            message: "Error interno"
        });

    }

};

export const enableTotp = async (req: Request, res: Response) => {

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

        console.log("PAYLOAD JWT:", payload);

        const { code } = req.body;

        console.log("CODE:", code);


        const secret = await prisma.totpSecret.findFirst({
            where: {
                userId: payload.id,
                confirmed: false,
                deletedAt: null
            }
        });

        console.log("SECRET:", secret);


        if (!secret)
            return res.status(404).json({
                message: "No existe TOTP"
            });


        const valid = verifyTotp(
            secret.secretEncrypted,
            code
        );


        console.log("VALID:", valid);


        if (!valid)
            return res.status(400).json({
                message: "Código inválido"
            });


        await prisma.totpSecret.update({
            where: {
                id: secret.id
            },
            data: {
                confirmed: true
            }
        });


        return res.json({
            message:"TOTP habilitado"
        });


    } catch(error:any) {

        console.error("ERROR ENABLE TOTP:", error);

        return res.status(500).json({
            message:error.message
        });

    }

};

export const verifyTotpLogin = async (req: Request, res: Response) => {

    try {

        const { mfaToken, code } = req.body;

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        const user = await prisma.usuario.findUnique({
            where: {
                id: payload.id
            },
            include: {
                rol: true
            }
        });

        if (!user)
            return res.status(404).json({
                message: "Usuario no encontrado"
            });

        const secret = await prisma.totpSecret.findFirst({
            where: {
                userId: user.id,
                confirmed: true,
                deletedAt: null
            }
        });

        if (!secret)
            return res.status(400).json({
                message: "No existe TOTP configurado"
            });

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
                message: "Código incorrecto"
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

    } catch {

        return res.status(500).json({
            message: "Error interno"
        });

    }

};