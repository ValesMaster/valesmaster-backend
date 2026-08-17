import { Router } from "express";
import { uploadPresolicitudFiles } from "../middlewares/uploads.middleware";
import {
    crearPresolicitud,
    validarPresolicitud,
    aprobarSolicitud,
    getPresolicitudes,
    getSolicitudes,
    getPresolicitudDetalle,
    getArchivoPresolicitud
} from "../controllers/solicitudes.controller";

const router = Router();

router.post('/crear', crearPresolicitud);
router.post('/validar/:id', validarPresolicitud);
router.post('/aprobar/:id', aprobarSolicitud);
router.get('/obtener-solicitudes', getSolicitudes);
router.get('/obtener-presolicitudes', getPresolicitudes);
router.get('/detalle-presolicitud/:id', uploadPresolicitudFiles, getPresolicitudDetalle);
router.get('/archivos/:nombreArchivo', getArchivoPresolicitud);

export default router;