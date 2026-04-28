// ============================================================
// workshops.routes.js — Rutas del módulo de talleres
// ============================================================
// GET  /api/v1/workshops       → Público
// GET  /api/v1/workshops/:id   → Público
// POST /api/v1/workshops       → Admin
// PUT    /api/v1/workshops/:id            → Admin
// PATCH  /api/v1/workshops/:id/reschedule → Admin / Therapist
// DELETE /api/v1/workshops/:id            → Admin (soft delete)
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const workshopsController = require('../controllers/workshops.controller');

const router = Router();

// -----------------------------------------------------------
// Rutas públicas (cualquier visitante puede consultar talleres)
// -----------------------------------------------------------
router.get('/', workshopsController.getAll);
router.get('/:id', workshopsController.getById);

// -----------------------------------------------------------
// Rutas protegidas (solo admin autenticado)
// -----------------------------------------------------------
router.post('/', verifyToken, authorizeRoles('admin'), workshopsController.create);
router.put('/:id', verifyToken, authorizeRoles('admin'), workshopsController.update);
router.patch('/:id/reschedule', verifyToken, authorizeRoles('admin', 'therapist'), workshopsController.reschedule);
router.delete('/:id', verifyToken, authorizeRoles('admin'), workshopsController.remove);

module.exports = router;
