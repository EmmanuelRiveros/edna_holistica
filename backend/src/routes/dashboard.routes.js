// ============================================================
// dashboard.routes.js — Ruta del dashboard de métricas
// ============================================================
// GET /api/v1/dashboard → Solo admin
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('admin'), dashboardController.getMetrics);

module.exports = router;
