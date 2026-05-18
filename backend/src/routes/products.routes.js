// ============================================================
// products.routes.js — Rutas de productos
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/products.controller');
const reviewsCtrl = require('../controllers/reviews.controller');

const router = Router();

// Públicas
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/reviews', reviewsCtrl.getByProduct);

// Solo admin
router.post('/', verifyToken, authorizeRoles('admin'), ctrl.create);
router.put('/:id', verifyToken, authorizeRoles('admin'), ctrl.update);
router.patch('/:id/stock', verifyToken, authorizeRoles('admin'), ctrl.updateStock);
router.delete('/:id', verifyToken, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
