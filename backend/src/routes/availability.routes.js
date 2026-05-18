// ============================================================
// availability.routes.js — Rutas del módulo de disponibilidad
// ============================================================
// GET  /api/v1/availability/slots          → Autenticado (slots libres)
// GET  /api/v1/availability/me             → Therapist / Admin
// PUT  /api/v1/availability/me             → Therapist / Admin
// GET  /api/v1/availability/:therapist_id  → Admin / Therapist / Client
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const availabilityController = require('../controllers/availability.controller');

const router = Router();

// Slots disponibles (cualquier rol autenticado)
router.get('/slots', verifyToken, availabilityController.getAvailableSlots);

// Disponibilidad propia del terapeuta
router.get('/me', verifyToken, authorizeRoles('therapist', 'admin'), availabilityController.getMyAvailability);
router.put('/me', verifyToken, authorizeRoles('therapist', 'admin'), availabilityController.updateMyAvailability);

// Disponibilidad de un terapeuta específico (por ID)
router.get('/:therapist_id', verifyToken, authorizeRoles('admin', 'therapist', 'client'), availabilityController.getTherapistAvailability);

module.exports = router;
