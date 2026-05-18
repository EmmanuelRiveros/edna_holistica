// ============================================================
// addresses.routes.js — Rutas de direcciones de envío
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/addresses.controller');

const router = Router();

router.get('/', verifyToken, authorizeRoles('client', 'admin'), ctrl.getMyAddresses);
router.post('/', verifyToken, authorizeRoles('client', 'admin'), ctrl.create);
router.put('/:id', verifyToken, authorizeRoles('client', 'admin'), ctrl.update);
router.patch('/:id/default', verifyToken, authorizeRoles('client', 'admin'), ctrl.setDefault);
router.delete('/:id', verifyToken, authorizeRoles('client', 'admin'), ctrl.remove);

module.exports = router;
