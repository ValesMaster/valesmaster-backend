import { Router } from "express";
import {
    crearPresolicitud,
    validarPresolicitud,
    aprobarSolicitud,
    getPresolicitudes,
    getSolicitudes,
    getPresolicitudDetalle
} from "../controllers/solicitudes.controller";

const router = Router();

router.post('/crear', crearPresolicitud);
router.post('/validar/:id', validarPresolicitud);
router.post('/aprobar/:id', aprobarSolicitud);
router.get('/obtener-solicitudes', getSolicitudes);
router.get('/obtener-presolicitudes', getPresolicitudes);
router.get('/detalle-presolicitud/:id', getPresolicitudDetalle);

export default router;