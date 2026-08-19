import {
    obtenerEmpleadosFiltrados,
    obtenerDetalleEmpleado,
    crearEmpleado,
    desactivarEmpleado,
    modificarEmpleado,
    obtenerSucursalesSelector
} from "../controllers/gerentes.controller";
import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get('/consultar/empleados', verifyToken, requireRole('gerente_general', 'gerente_sucursal'), obtenerEmpleadosFiltrados);
router.get('/obtener/empleado/:id', verifyToken, requireRole('gerente_general', 'gerente_sucursal'), obtenerDetalleEmpleado);
router.post('/crear/empleado', verifyToken, requireRole('gerente_general', 'gerente_sucursal'), crearEmpleado);
router.patch('/desactivar/empleado/:id', verifyToken, requireRole('gerente_general', 'gerente_sucursal'), desactivarEmpleado);
router.patch('/modificar/empleado/:id', verifyToken, requireRole('gerente_general', 'gerente_sucursal'), modificarEmpleado);
router.get('/obtener/sucursales-selector', verifyToken, requireRole('gerente_general', 'gerente_sucursal', 'coordinador', 'verificador'), obtenerSucursalesSelector);

export default router;