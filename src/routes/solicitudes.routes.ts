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
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.post('/crear', requireVpn, verifyToken, requireRole('coordinador'), uploadPresolicitudFiles, crearPresolicitud);
router.post('/validar/:id', requireVpn, verifyToken, requireRole('validador'), validarPresolicitud);
router.post('/aprobar/:id', requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), aprobarSolicitud);
router.get('/obtener-solicitudes', requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), getSolicitudes);
router.get('/obtener-presolicitudes', requireVpn, verifyToken, requireRole('validador', 'coordinador'), getPresolicitudes);
router.get('/detalle-presolicitud/:id', requireVpn, verifyToken, requireRole('validador', 'coordinador'), getPresolicitudDetalle);
router.get('/archivos/:nombreArchivo', requireVpn, verifyToken, requireRole('validador', 'coordinador'), getArchivoPresolicitud);

export default router;