import { Router } from "express";
import { crearPrevale, aprobarPrevale } from "../controllers/vales.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.post('/prevales/crear', verifyToken, requireRole('distribuidora'), crearPrevale);
//requireVpn
router.post('/prevales/aprobar/:id', verifyToken, requireRole('coordinador'), aprobarPrevale);

export default router;
