import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const generateEmailCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendLoginCode = async (
    email: string,
    code: string
): Promise<void> => {

    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Código de acceso",
        html: `
            <div style="font-family: Arial, Helvetica, sans-serif;">
                <h2>ValesMaster</h2>

                <p>Tu código de verificación es:</p>

                <h1 style="letter-spacing:4px;">
                    ${code}
                </h1>

                <p>
                    Este código expira en <b>5 minutos</b>.
                </p>

                <p>
                    Si no solicitaste este acceso, ignora este correo.
                </p>
            </div>
        `
    });

};