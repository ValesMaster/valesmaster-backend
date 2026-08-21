import { Router } from "express";
import { getAuditLogs } from "../controllers/audits.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.get('/logs', requireVpn, verifyToken, requireRole('administrador'), getAuditLogs);

export default router;