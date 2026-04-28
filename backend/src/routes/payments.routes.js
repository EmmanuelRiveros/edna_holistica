// ============================================================
// payments.routes.js — Rutas del módulo de pagos
// ============================================================
// GET    /api/v1/payments       → Admin
// POST   /api/v1/payments       → Admin
// PUT    /api/v1/payments/:id   → Admin
// GET    /api/v1/payments/reservation/:id → Autenticado (owner / admin / therapist)
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const paymentsController = require('../controllers/payments.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('admin'), paymentsController.getAll);
router.post('/', verifyToken, authorizeRoles('admin'), paymentsController.create);
router.put('/:id', verifyToken, authorizeRoles('admin'), paymentsController.update);
router.get('/reservation/:id', verifyToken, paymentsController.getByReservation);

module.exports = router;
