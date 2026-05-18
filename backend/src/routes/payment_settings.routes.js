// ============================================================
// payment_settings.routes.js — Rutas de configuración de pagos
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/payment_settings.controller');

const router = Router();

// Cualquier usuario autenticado puede ver los datos bancarios
router.get('/', verifyToken, ctrl.get);

// Solo admin puede crear/actualizar
router.put('/', verifyToken, authorizeRoles('admin'), ctrl.upsert);

module.exports = router;
