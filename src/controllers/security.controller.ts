import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { respondJwtError } from "../utils/jwtErrors";


export const getSecurityQuestions = async (
    req: Request,
    res: Response
) => {

    try {

        const { mfaToken } = req.body;

        if (!mfaToken) {
            return res.status(400).json({
                message: "El token es obligatorio."
            });
        }

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_SECURITY") {

            return res.status(401).json({

                message: "Token inválido."

            });

        }

        const questions = await prisma.securityQuestion.findMany({

            where: {

                userId: payload.id,

                deletedAt: null

            },

            select: {

                id: true,

                question: true

            }

        });

        return res.json({

            questions

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

export const setupSecurityQuestions = async (
    req: Request,
    res: Response
) => {

    try {

        const { mfaToken, securityQuestions } = req.body;

        if (!mfaToken) {
            return res.status(400).json({
                message: "El token es obligatorio."
            });
        }

        if (!Array.isArray(securityQuestions) || securityQuestions.length === 0) {
            return res.status(400).json({
                message: "Debe proporcionar al menos una pregunta de seguridad."
            });
        }

        const invalidItem = securityQuestions.some(
            (item) => !item?.question || !item?.answer
        );

        if (invalidItem) {
            return res.status(400).json({
                message: "Cada pregunta debe incluir 'question' y 'answer'."
            });
        }

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_SECURITY") {
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

        const existentes = await prisma.securityQuestion.findMany({
            where: {
                userId: user.id,
                deletedAt: null
            }
        });

        if (existentes.length > 0) {
            return res.status(409).json({
                message: "El usuario ya tiene preguntas de seguridad configuradas."
            });
        }

        const hashedQuestions = await Promise.all(
            securityQuestions.map(async (item: { question: string; answer: string }) => ({
                question: item.question,
                answerHash: await bcrypt.hash(item.answer, 10)
            }))
        );

        await prisma.$transaction(
            hashedQuestions.map((item) =>
                prisma.securityQuestion.create({
                    data: {
                        userId: user.id,
                        question: item.question,
                        answerHash: item.answerHash
                    }
                })
            )
        );

        await prisma.loginAttempt.create({
            data: {
                userId: user.id,
                emailAttempted: user.email,
                factorFailed: 3,
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

        return res.status(201).json({
            step: "COMPLETED",
            accessToken
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

export const verifySecurityQuestions = async (
    req: Request,
    res: Response
) => {

    try {

        const {
            mfaToken,
            answers
        } = req.body;

        if (!mfaToken) {

            return res.status(400).json({
                message: "El token es obligatorio."
            });

        }

        if (!Array.isArray(answers)) {

            return res.status(400).json({
                message: "Las respuestas son obligatorias."
            });

        }

        const payload: any = jwt.verify(
            mfaToken,
            process.env.JWT_SECRET!
        );

        if (payload.step !== "REQUIRE_SECURITY") {

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

        const questions = await prisma.securityQuestion.findMany({

            where: {

                userId: user.id,

                deletedAt: null

            },

            orderBy: {

                id: "asc"

            }

        });

        if (questions.length === 0) {

            return res.status(400).json({
                message: "El usuario no tiene preguntas de seguridad configuradas."
            });

        }

        if (answers.length !== questions.length) {

            return res.status(400).json({
                message: "Debe responder todas las preguntas."
            });

        }

        for (let i = 0; i < questions.length; i++) {

            const valid = await bcrypt.compare(
                answers[i],
                questions[i].answerHash
            );

            if (!valid) {

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

                    message: "Las respuestas de seguridad son incorrectas."

                });

            }

        }

        await prisma.loginAttempt.create({

            data: {

                userId: user.id,

                emailAttempted: user.email,

                factorFailed: 3,

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

    } catch (error) {

        console.error(error);

        const jwtResponse = respondJwtError(res, error);
        if (jwtResponse) return jwtResponse;

        return res.status(500).json({

            message: "Error interno."

        });

    }

};