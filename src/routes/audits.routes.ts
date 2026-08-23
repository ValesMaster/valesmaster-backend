import { Router } from "express";
import { getAuditLogs } from "../controllers/audits.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

//requireVpn
router.get('/logs', verifyToken, requireRole('administrador'), getAuditLogs);

export default router;