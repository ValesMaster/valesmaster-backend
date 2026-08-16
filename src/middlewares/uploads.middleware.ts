import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";

const NFS_DIR = path.join(__dirname, "../../uploads");
const LOCAL_FALLBACK_DIR = path.join(__dirname, "../../uploads-fallback");

if (!fs.existsSync(LOCAL_FALLBACK_DIR)) {
    fs.mkdirSync(LOCAL_FALLBACK_DIR, { recursive: true });
}

const getActiveStorageDir = () => {
    try {
        fs.accessSync(NFS_DIR, fs.constants.W_OK);
        return NFS_DIR;
    } catch (error) {
        console.warn("No se pudo conectar al servidor de almacenamiento");
        return LOCAL_FALLBACK_DIR;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = getActiveStorageDir();
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const cleanOriginalName = file.originalname.replace(/\s+/g, "_").toLowerCase();
        cb(null, `${uniqueSuffix}-${cleanOriginalName}`);
    }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
}

export const uploadPresolicitudFiles = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
}).fields([
    { name: 'ine', maxCount: 1 },
    { name: 'rfc', maxCount: 1 },
    { name: 'curp', maxCount: 1 },
    { name: 'comprobante_domicilio', maxCount: 1 }
])