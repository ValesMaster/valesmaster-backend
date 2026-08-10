import {
    obtenerEmpleadosFiltrados,
    obtenerDetalleEmpleado,
    crearEmpleado,
    desactivarEmpleado
} from "../controllers/gerentes.controller";
import { Router } from "express";

const router = Router();

router.get('/consultar/empleados', obtenerEmpleadosFiltrados);
router.get('/obtener/empleado/:id', obtenerDetalleEmpleado);
router.post('/crear/empleado', crearEmpleado);
router.patch('/desactivar/empleado/:id', desactivarEmpleado);

export default router;