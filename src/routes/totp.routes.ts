import { Router } from "express";

import {
    setupTotp,
    enableTotp,
    verifyTotpLogin
} from "../controllers/totp.controller";

const router = Router();

router.post("/setup", setupTotp);

router.post("/enable", enableTotp);

router.post("/verify", verifyTotpLogin);

export default router;