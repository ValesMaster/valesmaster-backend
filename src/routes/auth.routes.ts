import { Router } from "express";
import { loginPhaseOne, registerTest, validateToken, obtenerRoles } from "../controllers/auth.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.post('/register', registerTest);

router.post('/login', loginPhaseOne);

router.get('/validate', validateToken);

router.get(
    '/roles',
    verifyToken,
    requireRole('cajero', 'validador', 'gerente_sucursal', 'gerente_general', 'coordinador', 'administrador'),
    obtenerRoles
);

export default router;