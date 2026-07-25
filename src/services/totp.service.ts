import speakeasy from "speakeasy";

export const generateTotpSecret = (email: string) => {
    return speakeasy.generateSecret({
        name: `ValesMaster (${email})`,
        issuer: "ValesMaster",
        length: 20
    });
};

export const verifyTotp = (
    secret: string,
    token: string
) => {
    return speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token,
        window: 1
    });
};

export const generateRecoveryCodes = () => {
    const codes = [];

    for (let i = 0; i < 8; i++) {
        codes.push(
            Math.random().toString(36).substring(2, 10).toUpperCase()
        );
    }

    return codes;
};