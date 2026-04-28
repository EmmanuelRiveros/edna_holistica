// ============================================================
// clients.routes.js — Rutas del módulo de clientes
// ============================================================
// GET    /api/v1/clients               → Admin / Therapist
// GET    /api/v1/clients/:id           → Autenticado (owner / admin / therapist)
// PUT    /api/v1/clients/:id           → Autenticado (owner / admin)
// PATCH  /api/v1/clients/:id/deactivate → Admin
// PATCH  /api/v1/clients/:id/activate   → Admin
// DELETE /api/v1/clients/:id           → Admin (soft delete)
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const clientsController = require('../controllers/clients.controller');
const { upload } = require('../config/cloudinary');

const router = Router();

// -----------------------------------------------------------
// Rutas protegidas — todas requieren autenticación
// -----------------------------------------------------------
router.get('/', verifyToken, authorizeRoles('admin', 'therapist'), clientsController.getAll);
router.get('/:id', verifyToken, clientsController.getById);
router.put('/:id', verifyToken, clientsController.updateProfile);
router.post('/:id/photo', verifyToken, authorizeRoles('admin', 'therapist'), upload.single('avatar'), clientsController.uploadPhoto);
router.patch('/:id/activate', verifyToken, authorizeRoles('admin'), clientsController.activate);
router.patch('/:id/deactivate', verifyToken, authorizeRoles('admin'), clientsController.deactivate);
router.delete('/:id', verifyToken, authorizeRoles('admin'), clientsController.remove);

module.exports = router;
