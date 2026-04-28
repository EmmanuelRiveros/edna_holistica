// ============================================================
// agenda.routes.js — Rutas del módulo de agenda
// ============================================================
// GET /api/v1/agenda → Admin / Therapist
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const agendaController = require('../controllers/agenda.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('admin', 'therapist'), agendaController.getCalendarEvents);

module.exports = router;
