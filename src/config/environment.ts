type Environment = Record<string, string | undefined>;

const requiredVariables = ['DATABASE_URL', 'MONGO_URI', 'JWT_SECRET'] as const;

export function validateEnvironment(config: Environment) {
    const missing = requiredVariables.filter((name) => !config[name]?.trim());

    if (missing.length > 0) {
        throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
    }

    const port = Number(config.PORT ?? 2552);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT debe ser un puerto TCP valido');
    }

    return {
        ...config,
        PORT: port,
        FRONTEND_URL: config.FRONTEND_URL?.trim() || 'http://localhost:3000'
    };
}
