import {
    obtenerEmpleadosFiltrados,
    obtenerDetalleEmpleado,
    crearEmpleado
} from "../controllers/gerentes.controller";
import { Router } from "express";

const router = Router();

router.get('/consultar/empleados', obtenerEmpleadosFiltrados);
router.get('/obtener/empleado/:id', obtenerDetalleEmpleado);
router.post('/crear/empleado', crearEmpleado);

export default router;