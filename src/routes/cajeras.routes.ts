import { obtenerCanjes, obtenerDistribuidoras, canjearPuntos } from "../controllers/cajera.controller"
import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get('/canjes', verifyToken, requireRole('cajero'), obtenerCanjes);
router.get('/distribuidoras', verifyToken, requireRole('cajero'), obtenerDistribuidoras);
router.post('/canjear', verifyToken, requireRole('cajero'), canjearPuntos);

export default router;