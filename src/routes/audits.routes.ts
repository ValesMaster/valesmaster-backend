import { Router } from "express";
import { getAuditLogs } from "../controllers/audits.controller";

const router = Router();

router.get('/logs', getAuditLogs);

export default router;