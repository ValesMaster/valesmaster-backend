import { Router } from "express";
import { crearPresolicitud, validarPresolicitud, AprobarSolicitud } from "../controllers/solicitudes.controller";

const router = Router();

router.post('/crear-presolicitud', crearPresolicitud);
router.post('/validar-presolicitud/:id', validarPresolicitud);
router.post('/aprobar-solicitud/:id', AprobarSolicitud);

export default router;