// ============================================================
// clinical_notes.routes.js — Rutas de notas clínicas
// ============================================================
// Todas las rutas requieren admin o therapist.
// Los clientes NO tienen acceso a este módulo.
// GET    /api/v1/clinical-notes       → Lista (con privacidad)
// GET    /api/v1/clinical-notes/:id   → Detalle (con privacidad)
// POST   /api/v1/clinical-notes       → Crear
// PUT    /api/v1/clinical-notes/:id   → Actualizar contenido
// DELETE /api/v1/clinical-notes/:id   → Soft delete
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const clinicalNotesController = require('../controllers/clinical_notes.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('admin', 'therapist'), clinicalNotesController.getAll);
router.get('/:id', verifyToken, authorizeRoles('admin', 'therapist'), clinicalNotesController.getById);
router.post('/', verifyToken, authorizeRoles('admin', 'therapist'), clinicalNotesController.create);
router.put('/:id', verifyToken, authorizeRoles('admin', 'therapist'), clinicalNotesController.update);
router.delete('/:id', verifyToken, authorizeRoles('admin', 'therapist'), clinicalNotesController.remove);

module.exports = router;
