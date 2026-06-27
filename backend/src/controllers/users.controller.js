// ============================================================
// users.controller.js — CRUD de usuarios (admin scope)
// ============================================================
// Funciones: getAll, getById, create, update, resetPassword, remove
// Solo admin puede acceder a estos endpoints.
// NUNCA retorna password_hash en las respuestas.
// ============================================================

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');

const SALT_ROUNDS = 10;

// Columnas de lectura (sin password_hash)
const USER_COLS = `id, first_name, last_name, email, phone, \`role\`, is_active, created_at, updated_at`;

// -----------------------------------------------------------
// GET /api/v1/users
// Lista usuarios con paginación, filtro por rol y búsqueda.
// Solo admin.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { role, search } = req.query;

    // WHERE dinámico
    const conditions = ['deleted_at IS NULL'];
    const values = [];

    if (role) {
      conditions.push(`\`role\` = ?`);
      values.push(role);
    }

    if (search) {
      conditions.push(
        `(CONCAT(first_name, ' ', last_name) LIKE ? OR email LIKE ?)`
      );
      values.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros paginados
    const [dataRows] = await pool.query(
      `SELECT ${USER_COLS}
       FROM users
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    // Mapear booleanos
    const users = dataRows.map(r => ({ ...r, is_active: !!r.is_active }));

    return res.status(200).json({
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Usuarios obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/users/:id
// Retorna un usuario por ID. Solo admin.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT ${USER_COLS}
       FROM users
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    const user = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { user },
      message: 'Usuario obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/users
// Crea un usuario con cualquier rol. Solo admin.
// Si el rol es 'client', también crea un client_profiles vacío.
// -----------------------------------------------------------
const create = async (req, res) => {
  const { first_name, last_name, email, password, phone, role } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      error: 'Los campos first_name, last_name, email y password son obligatorios',
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar unicidad del email
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

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const assignedRole = role || 'client';
    const id = crypto.randomUUID();

    await conn.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, phone, \`role\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, first_name, last_name, email, password_hash, phone || null, assignedRole]
    );

    // Si es client, crear perfil vacío
    if (assignedRole === 'client') {
      await conn.query(
        'INSERT INTO client_profiles (user_id) VALUES (?)',
        [id]
      );
    }

    await conn.query('COMMIT');

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE id = ?`,
      [id]
    );

    const user = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(201).json({
      data: { user },
      message: 'Usuario creado exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en create users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// PUT /api/v1/users/:id
// Actualiza datos del usuario. Solo admin.
// NO actualiza password (tiene su propio endpoint).
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'role', 'is_active'];

    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // "role" es palabra reservada en MySQL
        const col = field === 'role' ? '`role`' : field;
        setClauses.push(`${col} = ?`);
        values.push(req.body[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'Debes enviar al menos un campo para actualizar',
      });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE id = ?`,
      [id]
    );

    const user = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { user },
      message: 'Usuario actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/users/:id/reset-password
// Resetea la contraseña de un usuario. Solo admin.
// -----------------------------------------------------------
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'El campo password es obligatorio',
      });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `UPDATE users
       SET password_hash = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [password_hash, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en resetPassword users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/users/:id
// Soft delete. Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE users
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete users:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, update, resetPassword, remove };
