// ============================================================
// auth.controller.js — Controlador de autenticación
// ============================================================
// Funciones: register, login, me
// Todas usan try/catch y formato de respuesta consistente:
//   Éxito: { data: {...}, message: "..." }
//   Error: { error: "mensaje descriptivo" }
// Nunca se retorna password_hash en ninguna respuesta.
// ============================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SALT_ROUNDS = 10;

/**
 * Genera un JWT con id, email y role del usuario.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// -----------------------------------------------------------
// POST /api/v1/auth/register
// Crea un usuario con rol 'client' por defecto.
// Usa transacción SQL para insertar en users + client_profiles.
// -----------------------------------------------------------
const register = async (req, res) => {
  const { first_name, last_name, email, password, phone } = req.body;

  // Validación básica de campos requeridos
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      error: 'Los campos first_name, last_name, email y password son obligatorios',
    });
  }

  // Obtener un client del pool para manejar la transacción
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si el email ya existe (solo entre no eliminados)
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'El email ya está registrado',
      });
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insertar usuario con rol 'client' por defecto
    const userResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'client')
       RETURNING id, first_name, last_name, email, phone, role, is_active, created_at`,
      [first_name, last_name, email, password_hash, phone || null]
    );

    const newUser = userResult.rows[0];

    // Insertar registro vacío en client_profiles vinculado al usuario
    await client.query(
      `INSERT INTO client_profiles (user_id) VALUES ($1)`,
      [newUser.id]
    );

    await client.query('COMMIT');

    // Generar token JWT
    const token = generateToken(newUser);

    return res.status(201).json({
      data: {
        user: newUser,
        token,
      },
      message: 'Usuario registrado exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en register:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    // Devolver el client al pool (SIEMPRE, incluso si hubo error)
    client.release();
  }
};

// -----------------------------------------------------------
// POST /api/v1/auth/login
// Autentica un usuario existente y retorna token JWT.
// Mensaje genérico para email o password incorrectos
// (previene enumeración de usuarios).
// -----------------------------------------------------------
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Los campos email y password son obligatorios',
    });
  }

  try {
    // Buscar usuario activo no eliminado
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, role, is_active, created_at
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    // Email no encontrado → mensaje genérico
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    const user = result.rows[0];

    // Cuenta desactivada
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    // Generar token
    const token = generateToken(user);

    // Retornar usuario SIN password_hash
    const { password_hash, ...userWithoutPassword } = user;

    return res.status(200).json({
      data: {
        user: userWithoutPassword,
        token,
      },
      message: 'Inicio de sesión exitoso',
    });
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/auth/me
// Retorna los datos del usuario autenticado.
// Si es cliente, incluye datos de client_profiles via JOIN.
// Requiere middleware verifyToken.
// -----------------------------------------------------------
const me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         u.role,
         u.is_active,
         u.created_at,
         cp.id              AS profile_id,
         cp.date_of_birth,
         cp.allergies,
         cp.medical_conditions,
         cp.photo_url,
         cp.preferred_contact
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    const row = result.rows[0];

    // Estructurar respuesta: datos base + perfil de cliente (si aplica)
    const userData = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
    };

    // Solo incluir client_profile si existe (rol client)
    if (row.profile_id) {
      userData.client_profile = {
        id: row.profile_id,
        date_of_birth: row.date_of_birth,
        allergies: row.allergies,
        medical_conditions: row.medical_conditions,
        photo_url: row.photo_url,
        preferred_contact: row.preferred_contact,
      };
    }

    return res.status(200).json({
      data: { user: userData },
      message: 'Perfil obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en me:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { register, login, me };
