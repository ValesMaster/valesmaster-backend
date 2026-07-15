import mongoose from 'mongoose';

export const connectMongo = async (): Promise<void> => {
    await mongoose.connect(process.env.MONGO_URI!)
        .then(() => console.log('MongoDB conectado'))
        .catch((err) => {
            console.error('Error conectando a MongoDB:', err);
            process.exit(1);
        });
};