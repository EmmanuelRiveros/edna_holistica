// ============================================================
// services.routes.js — Rutas del módulo de servicios
// ============================================================
// GET  /api/v1/services       → Público
// GET  /api/v1/services/:id   → Público
// POST /api/v1/services       → Admin
// PUT  /api/v1/services/:id   → Admin
// DELETE /api/v1/services/:id → Admin (soft delete)
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const servicesController = require('../controllers/services.controller');

const router = Router();

// -----------------------------------------------------------
// Rutas públicas (cualquier visitante puede consultar servicios)
// -----------------------------------------------------------
router.get('/', servicesController.getAll);
router.get('/:id/therapists', verifyToken, servicesController.getTherapists);
router.get('/:id', servicesController.getById);

// -----------------------------------------------------------
// Rutas protegidas (solo admin autenticado)
// -----------------------------------------------------------
router.post('/', verifyToken, authorizeRoles('admin'), servicesController.create);
router.put('/:id', verifyToken, authorizeRoles('admin'), servicesController.update);
router.delete('/:id', verifyToken, authorizeRoles('admin'), servicesController.remove);

module.exports = router;
