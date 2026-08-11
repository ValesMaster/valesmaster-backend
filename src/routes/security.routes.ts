import { Router } from "express";

import {
    getSecurityQuestions,
    verifySecurityQuestions
} from "../controllers/security.controller";

const router = Router();

router.post("/questions", getSecurityQuestions);

router.post("/verify", verifySecurityQuestions);

export default router;