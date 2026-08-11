import { Router } from "express";

import {
    getSecurityQuestions,
    setupSecurityQuestions,
    verifySecurityQuestions
} from "../controllers/security.controller";

const router = Router();

router.post("/questions", getSecurityQuestions);

router.post("/setup", setupSecurityQuestions);

router.post("/verify", verifySecurityQuestions);

export default router;