import mongoose from 'mongoose';

export const connectMongo = async (): Promise<boolean> => {
    try {
        await mongoose.connect(process.env.MONGO_URI!, {
            serverSelectionTimeoutMS: 3000
        });
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.warn(`MongoDB no disponible; se continuara sin bitacora: ${message}`);
        return false;
    }
};
