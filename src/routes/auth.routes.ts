import { Router } from "express";
import { loginPhaseOne, registerTest, validateToken, obtenerRoles } from "../controllers/auth.controller";

const router = Router();

router.post('/register', registerTest);

router.post('/login', loginPhaseOne);

router.get('/validate', validateToken);

router.get('/roles', obtenerRoles);

export default router;