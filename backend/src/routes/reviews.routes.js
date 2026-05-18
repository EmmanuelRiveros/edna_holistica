// ============================================================
// reviews.routes.js — Rutas de reseñas
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/reviews.controller');

const router = Router();

// Todas las reseñas para moderación (Solo Admin)
router.get('/', verifyToken, authorizeRoles('admin'), ctrl.getAll);

// Crear reseña (Solo Client)
router.post('/', verifyToken, authorizeRoles('client'), ctrl.create);

// Aprobar/Rechazar reseña (Solo Admin)
router.patch('/:id/moderate', verifyToken, authorizeRoles('admin'), ctrl.moderate);

// Eliminar reseña (Solo Admin)
router.delete('/:id', verifyToken, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
