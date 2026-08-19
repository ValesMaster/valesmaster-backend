import { Router } from "express";
import { getAuditLogs } from "../controllers/audits.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get('/logs', verifyToken, requireRole('administrador'), getAuditLogs);

export default router;