import { Router } from "express";
import { obtenerCambios, aprobarCambio, rechazarCambio } from "../controllers/cambios.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.get('/obtener', verifyToken, requireRole('coordinador'), obtenerCambios);
router.post('/aprobar/:id', requireVpn, verifyToken, requireRole('coordinador'), aprobarCambio);
router.post('/rechazar/:id', requireVpn, verifyToken, requireRole('coordinador'), rechazarCambio);

export default router;
