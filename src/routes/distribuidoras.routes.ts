import {
    obtenerPerfil,
    obtenerDistribuidoras,
    obtenerClientes,
    crearCliente,
    obtenerDetalleCliente,
    modificarCliente,
    eliminarCliente
} from '../controllers/distribuidoras.controller';
import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
import { requireVpn } from '../middlewares/vpn.middleware';

const router = Router();

router.post('/consultar/perfil', verifyToken, requireRole('distribuidora'), obtenerPerfil);
router.get('/obtener', verifyToken, requireRole('coordinador', 'gerente_general', 'gerente_sucursal'), obtenerDistribuidoras);
router.post('/consultar/clientes', verifyToken, requireRole('distribuidora', 'gerente_general', 'gerente_sucursal', 'coordinador'), obtenerClientes);
router.post('/crear/cliente', verifyToken, requireRole('distribuidora'), crearCliente);
router.get('/obtener/cliente/:id', verifyToken, requireRole('distribuidora'), obtenerDetalleCliente);
router.patch('/modificar/cliente/:id', verifyToken, requireRole('distribuidora'), modificarCliente);
router.patch('/eliminar/cliente/:id', verifyToken, requireRole('distribuidora'), eliminarCliente);

export default router;