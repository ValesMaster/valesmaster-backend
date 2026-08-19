import { Router } from "express";

import {
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  deleteSucursal,
} from "../controllers/sucursales.controller";

const router = Router();

// Obtener todas
router.get("/", getSucursales);

// Obtener por ID
router.get("/:id", getSucursalById);

// Crear
router.post("/", createSucursal);

// Modificar
router.put("/:id", updateSucursal);

// Soft delete
router.delete("/:id", deleteSucursal);

export default router;