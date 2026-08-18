import {
    obtenerEmpleadosFiltrados,
    obtenerDetalleEmpleado,
    crearEmpleado,
    desactivarEmpleado,
    modificarEmpleado,
    obtenerSucursalesSelector
} from "../controllers/gerentes.controller";
import { Router } from "express";

const router = Router();

router.get('/consultar/empleados', obtenerEmpleadosFiltrados);
router.get('/obtener/empleado/:id', obtenerDetalleEmpleado);
router.post('/crear/empleado', crearEmpleado);
router.patch('/desactivar/empleado/:id', desactivarEmpleado);
router.patch('/modificar/empleado/:id', modificarEmpleado);
router.get('/obtener/sucursales-selector', obtenerSucursalesSelector);

export default router;