const express = require('express');
const router = express.Router();
const therapistServicesController = require('../controllers/therapist_services.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// GET /api/v1/therapist-services/me
router.get(
  '/me',
  verifyToken,
  authorizeRoles('therapist', 'admin'),
  therapistServicesController.getMyServices
);

// POST /api/v1/therapist-services
router.post(
  '/',
  verifyToken,
  authorizeRoles('therapist', 'admin'),
  therapistServicesController.addService
);

// DELETE /api/v1/therapist-services/:service_id
router.delete(
  '/:service_id',
  verifyToken,
  authorizeRoles('therapist', 'admin'),
  therapistServicesController.removeService
);

module.exports = router;
