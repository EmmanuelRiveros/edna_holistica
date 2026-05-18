// ============================================================
// orders.routes.js — Rutas de órdenes
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/orders.controller');

const router = Router();

// Admin: listar todas las órdenes
router.get('/', verifyToken, authorizeRoles('admin'), ctrl.getAll);

// Client: listar mis órdenes (ANTES de /:id para evitar conflicto)
router.get('/my-orders', verifyToken, authorizeRoles('client'), ctrl.getMyOrders);

// Autenticado: ver detalle de una orden (admin o cliente dueño)
router.get('/:id', verifyToken, ctrl.getById);

// Client o admin: crear orden
router.post('/', verifyToken, authorizeRoles('admin', 'client'), ctrl.create);

// Admin: cambiar status
router.patch('/:id/status', verifyToken, authorizeRoles('admin'), ctrl.updateStatus);

module.exports = router;
