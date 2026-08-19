declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                rol: string;
            };
        }
    }
}

export { };
