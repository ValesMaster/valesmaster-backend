import { Router } from "express";
import { crearPrevale, aprobarPrevale, obtenerVales, obtenerDetallePrevale, registrarPago, registrarPagoDistribuidora } from "../controllers/vales.controller";
import { verifyToken, requireRole } from "../middlewares/auth.middleware";
import { requireVpn } from "../middlewares/vpn.middleware";

const router = Router();

router.post('/prevales/crear', verifyToken, requireRole('distribuidora'), crearPrevale);
//requireVpn
router.post('/prevales/aprobar/:id', verifyToken, requireRole('coordinador'), aprobarPrevale);
router.get('/obtener', requireVpn, verifyToken, requireRole('gerente_general', 'gerente_sucursal'), obtenerVales);
router.get('/prevales/detalle/:id', verifyToken, requireRole('distribuidora', 'coordinador', 'gerente_general', 'gerente_sucursal'), obtenerDetallePrevale);
router.post('/pagos/registrar/:id', verifyToken, requireRole('cajero'), registrarPago);
router.post('/pagos-distribuidora/registrar/:id', verifyToken, requireRole('coordinador'), registrarPagoDistribuidora);

export default router;
