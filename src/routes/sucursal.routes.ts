import { Router } from "express";

import {
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  deleteSucursal,
} from "../controllers/sucursales.controller";
import { requireRole, verifyToken } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

// Obtener todas
router.get("/obtener", requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), getSucursales);

// Obtener por ID
router.get("/obtener/detalle/:id", requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), getSucursalById);

// Crear
router.post("/crear", requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), createSucursal);

// Modificar
router.put("/modificar/:id", requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), updateSucursal);

// Soft delete
router.delete("/eliminar/:id", requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), deleteSucursal);

export default router;