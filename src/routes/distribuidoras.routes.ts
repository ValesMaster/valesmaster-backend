import {
    obtenerPerfil,
    obtenerClientes,
    crearCliente,
    obtenerDetalleCliente
} from '../controllers/distribuidoras.controller';
import { Router } from 'express';

const router = Router();

router.post('/consultar/perfil', obtenerPerfil);
router.post('/consultar/clientes', obtenerClientes);
router.post('/crear/cliente', crearCliente);
router.get('/obtener/cliente/:id', obtenerDetalleCliente);

export default router;