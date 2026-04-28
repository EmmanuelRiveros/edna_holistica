// ============================================================
// auth.routes.js — Rutas de autenticación
// ============================================================
// Todas las rutas están bajo /api/v1/auth (montadas en app.js).
//
//   POST /api/v1/auth/register  → Registro de nuevo usuario
//   POST /api/v1/auth/login     → Inicio de sesión
//   GET  /api/v1/auth/me        → Perfil del usuario autenticado
// ============================================================

const { Router } = require('express');
const { register, login, me } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

const router = Router();

// Rutas públicas (no requieren token)
router.post('/register', register);
router.post('/login', login);

// Ruta protegida (requiere Bearer token válido)
router.get('/me', verifyToken, me);

module.exports = router;
