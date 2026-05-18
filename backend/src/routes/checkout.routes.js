// ============================================================
// checkout.routes.js — Rutas de pasarelas de pago
// ============================================================

const { Router } = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const ctrl = require('../controllers/checkout.controller');

const router = Router();

// MercadoPago
router.post('/mp/preference', verifyToken, authorizeRoles('admin', 'client'), ctrl.createMPPreference);
router.post('/mp/webhook', ctrl.mpWebhook); // Público — MP envía notificaciones aquí
router.post('/mp/reservation-preference', verifyToken, authorizeRoles('admin', 'client'), ctrl.createReservationMPPreference);
router.post('/mp/reservation-webhook', ctrl.mpReservationWebhook); // Público

// PayPal
router.post('/paypal/create-order', verifyToken, authorizeRoles('admin', 'client'), ctrl.createPayPalOrder);
router.post('/paypal/capture', verifyToken, authorizeRoles('admin', 'client'), ctrl.capturePayPalOrder);
router.post('/paypal/reservation-order', verifyToken, authorizeRoles('admin', 'client'), ctrl.createReservationPayPalOrder);
router.post('/paypal/reservation-capture', verifyToken, authorizeRoles('admin', 'client'), ctrl.captureReservationPayPal);

module.exports = router;
