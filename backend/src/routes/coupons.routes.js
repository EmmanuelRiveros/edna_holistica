// ============================================================
// coupons.routes.js — Rutas de cupones
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/coupons.controller');

const router = Router();

// Admin: listar todos los cupones
router.get('/', verifyToken, authorizeRoles('admin'), ctrl.getAll);

// Autenticado: validar un cupón (ANTES de /:id)
router.get('/validate', verifyToken, ctrl.validate);

// Admin: crear cupón
router.post('/', verifyToken, authorizeRoles('admin'), ctrl.create);

// Admin: actualizar cupón
router.put('/:id', verifyToken, authorizeRoles('admin'), ctrl.update);

// Admin: desactivar cupón
router.delete('/:id', verifyToken, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
