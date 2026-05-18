// ============================================================
// categories.routes.js — Rutas de categorías de productos
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/categories.controller');

const router = Router();

// Pública
router.get('/', ctrl.getAll);

// Solo admin
router.post('/', verifyToken, authorizeRoles('admin'), ctrl.create);
router.put('/:id', verifyToken, authorizeRoles('admin'), ctrl.update);
router.delete('/:id', verifyToken, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
