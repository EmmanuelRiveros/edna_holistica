// ============================================================
// reservations.routes.js — Rutas del módulo de reservas
// ============================================================
// GET    /api/v1/reservations              → Admin / Therapist
// GET    /api/v1/reservations/:id          → Autenticado (owner / admin / therapist)
// POST   /api/v1/reservations              → Admin / Client
// PATCH  /api/v1/reservations/:id/status   → Admin / Therapist
// PATCH  /api/v1/reservations/:id/notes       → Admin / Therapist
// PATCH  /api/v1/reservations/:id/reschedule  → Admin / Therapist
// DELETE /api/v1/reservations/:id             → Admin (soft delete)
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const reservationsController = require('../controllers/reservations.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('admin', 'therapist', 'client'), reservationsController.getAll);
router.get('/:id', verifyToken, reservationsController.getById);
router.post('/', verifyToken, authorizeRoles('admin', 'client'), reservationsController.create);
router.patch('/:id/status', verifyToken, authorizeRoles('admin', 'therapist', 'client'), reservationsController.updateStatus);
router.patch('/:id/notes', verifyToken, authorizeRoles('admin', 'therapist'), reservationsController.addNotes);
router.patch('/:id/reschedule', verifyToken, authorizeRoles('admin', 'therapist'), reservationsController.reschedule);
router.delete('/:id', verifyToken, authorizeRoles('admin'), reservationsController.remove);

module.exports = router;
