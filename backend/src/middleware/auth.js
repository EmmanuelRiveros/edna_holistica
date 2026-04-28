// ============================================================
// auth.js — Middleware de autenticación JWT
// ============================================================
// Verifica el token Bearer en el header Authorization.
// Si es válido, decodifica el payload y lo pone en req.user.
// Si falta o es inválido, retorna 401.
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * Middleware: verifyToken
 * Extrae y verifica el JWT del header Authorization.
 * Uso: router.get('/ruta-protegida', verifyToken, controller.fn)
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // El header debe existir y tener formato "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token de autenticación requerido',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Decodifica el payload: { id, email, role, iat, exp }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Pone los datos del usuario en req.user para los controllers
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido o expirado',
    });
  }
};

/**
 * Middleware factory: authorizeRoles
 * Restringe el acceso a los roles indicados.
 * Debe usarse DESPUÉS de verifyToken (necesita req.user).
 * Uso: router.post('/ruta', verifyToken, authorizeRoles('admin'), controller.fn)
 */
const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'No tienes permisos para realizar esta acción',
    });
  }
  next();
};

module.exports = { verifyToken, authorizeRoles };
