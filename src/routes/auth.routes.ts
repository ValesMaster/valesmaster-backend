import { Router } from "express";
import { loginPhaseOne, registerTest, validateToken } from "../controllers/auth.controller";

const router = Router();

router.post('/register', registerTest);

router.post('/login', loginPhaseOne);

router.get('/validate', validateToken);

export default router;