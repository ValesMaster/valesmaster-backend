import { Router } from "express";

import {
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  deleteSucursal,
} from "../controllers/sucursales.controller";
import { requireRole, verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Obtener todas
router.get("/obtener", verifyToken, requireRole('gerente_general', 'gerente_sucursal'), getSucursales);

// Obtener por ID
router.get("obtener/detalle/:id", verifyToken, requireRole('gerente_general', 'gerente_sucursal'), getSucursalById);

// Crear
router.post("/crear", verifyToken, requireRole('gerente_general', 'gerente_sucursal'), createSucursal);

// Modificar
router.put("modificar/:id", verifyToken, requireRole('gerente_general', 'gerente_sucursal'), updateSucursal);

// Soft delete
router.delete("eliminar/:id", verifyToken, requireRole('gerente_general', 'gerente_sucursal'), deleteSucursal);

export default router;