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
const crypto = require('crypto');
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

  // Obtener una conexión del pool para manejar la transacción
  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar si el email ya existe (solo entre no eliminados)
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );

    if (existing.length > 0) {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: 'El email ya está registrado',
      });
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generar UUID en Node
    const userId = crypto.randomUUID();

    // Insertar usuario con rol 'client' por defecto
    await conn.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, phone, \`role\`)
       VALUES (?, ?, ?, ?, ?, ?, 'client')`,
      [userId, first_name, last_name, email, password_hash, phone || null]
    );

    // Obtener el usuario recién creado
    const [userRows] = await conn.query(
      `SELECT id, first_name, last_name, email, phone, \`role\`, is_active, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    const newUser = { ...userRows[0], is_active: !!userRows[0].is_active };

    // Insertar registro vacío en client_profiles vinculado al usuario
    await conn.query(
      `INSERT INTO client_profiles (user_id) VALUES (?)`,
      [newUser.id]
    );

    await conn.query('COMMIT');

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
    await conn.query('ROLLBACK');
    console.error('❌ Error en register:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    // Devolver la conexión al pool (SIEMPRE, incluso si hubo error)
    conn.release();
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
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, \`role\`, is_active, created_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL`,
      [email]
    );

    // Email no encontrado → mensaje genérico
    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    const user = { ...rows[0], is_active: !!rows[0].is_active };

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
    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         u.\`role\`,
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
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    const row = rows[0];

    // Estructurar respuesta: datos base + perfil de cliente (si aplica)
    const userData = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      is_active: !!row.is_active,
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
