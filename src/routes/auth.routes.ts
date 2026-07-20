import { Router } from "express";
import { loginPhaseOne, registerTest } from "../controllers/auth.controller";

const router = Router();

router.post('/register', registerTest);

router.post('/login', loginPhaseOne);

export default router;