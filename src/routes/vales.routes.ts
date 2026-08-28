import { Router } from "express";
import {
    crearPrevale, aprobarPrevale, obtenerVales, obtenerPrevales, obtenerDetallePrevale, obtenerDetalleVale,
    registrarPago, registrarPagoDistribuidora,
    obtenerConciliacionPagos, obtenerConciliacionPagosDistribuidora
} from "../controllers/vales.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.post('/prevales/crear', verifyToken, requireRole('distribuidora'), crearPrevale);
router.post('/prevales/aprobar/:id', requireVpn, verifyToken, requireRole('coordinador'), aprobarPrevale);
router.get('/obtener', verifyToken, requireRole('distribuidora', 'cajero', 'coordinador', 'gerente_general', 'gerente_sucursal'), obtenerVales);
router.get('/detalle/:id', verifyToken, requireRole('distribuidora', 'cajero', 'coordinador', 'gerente_general', 'gerente_sucursal'), obtenerDetalleVale);
router.get('/prevales/obtener', requireVpn, verifyToken, requireRole('distribuidora', 'coordinador', 'gerente_general', 'gerente_sucursal'), obtenerPrevales);
router.get('/prevales/detalle/:id', requireVpn, verifyToken, requireRole('distribuidora', 'coordinador', 'gerente_general', 'gerente_sucursal'), obtenerDetallePrevale);
router.post('/pagos/registrar/:id', verifyToken, requireRole('cajero'), registrarPago);
router.post('/pagos-distribuidora/registrar/:id', verifyToken, requireRole('coordinador', 'cajero'), registrarPagoDistribuidora);
router.get('/conciliaciones/pagos', verifyToken, requireRole('cajero', 'gerente_general', 'gerente_sucursal'), obtenerConciliacionPagos);
router.get('/conciliaciones/pagos-distribuidora', verifyToken, requireRole('cajero', 'gerente_general', 'gerente_sucursal'), obtenerConciliacionPagosDistribuidora);

export default router;
