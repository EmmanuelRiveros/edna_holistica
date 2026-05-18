// ============================================================
// clients.controller.js — Gestión de clientes
// ============================================================
// Funciones: getAll, getById, updateProfile, activate, deactivate, remove
// Maneja users (role='client') + client_profiles.
// NUNCA retorna password_hash en las respuestas.
// ============================================================

const pool = require('../config/db');

// Columnas base de usuario (sin password_hash)
const USER_COLS = `u.id, u.first_name, u.last_name, u.email, u.phone,
                   u.role, u.is_active, u.created_at, u.updated_at`;

// Perfil como objeto JSON anidado
const PROFILE_OBJ = `json_build_object(
  'id',                cp.id,
  'date_of_birth',     cp.date_of_birth,
  'allergies',         cp.allergies,
  'medical_conditions',cp.medical_conditions,
  'photo_url',         cp.photo_url,
  'preferred_contact', cp.preferred_contact
) AS profile`;

// -----------------------------------------------------------
// GET /api/v1/clients
// Lista clientes con paginación y búsqueda opcional.
// Solo admin / therapist.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 100, 1);
    const offset = (page - 1) * limit;
    const { search } = req.query;

    // WHERE dinámico
    const conditions = ["u.role = 'client'", 'u.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (req.user.role === 'therapist') {
      conditions.push(`u.id IN (
        SELECT DISTINCT r.client_id 
        FROM reservations r
        WHERE r.therapist_id = $${paramIndex}
        AND r.deleted_at IS NULL
        AND r.client_id IS NOT NULL
      )`);
      values.push(req.user.id);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(u.first_name || ' ' || u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      );
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros paginados
    const dataResult = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        clients: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Clientes obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/clients/:id
// Retorna un cliente con su perfil. Accesible para admin,
// therapist o el mismo cliente.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar permisos
    if (req.user.id !== id && req.user.role !== 'admin' && req.user.role !== 'therapist') {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    if (req.user.role === 'therapist') {
      const resCheck = await pool.query(
        `SELECT id FROM reservations WHERE client_id = $1 AND therapist_id = $2 AND deleted_at IS NULL`,
        [id, req.user.id]
      );
      if (resCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'No tienes acceso al expediente de este cliente',
        });
      }
    }

    const result = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'client' AND u.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    // Obtener historial de reservas del cliente
    const historyResult = await pool.query(
      `SELECT r.id, r.scheduled_at, r.status, r.notes,
              s.name AS service_name,
              w.name AS workshop_name
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.client_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.scheduled_at DESC`,
      [id]
    );

    return res.status(200).json({
      data: {
        client: result.rows[0],
        reservation_history: historyResult.rows,
      },
      message: 'Cliente obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/clients/:id
// Actualiza datos del usuario y/o client_profiles.
// Solo el mismo cliente o admin.
// -----------------------------------------------------------
const updateProfile = async (req, res) => {
  const { id } = req.params;

  // Verificar permisos
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'No tienes permisos para realizar esta acción',
    });
  }

  // Separar campos por tabla
  const userFields = ['first_name', 'last_name', 'phone', 'email'];
  const profileFields = ['date_of_birth', 'allergies', 'medical_conditions', 'photo_url', 'preferred_contact'];

  const userSets = [];
  const userValues = [];
  let userParam = 1;

  for (const field of userFields) {
    if (req.body[field] !== undefined) {
      userSets.push(`${field} = $${userParam}`);
      userValues.push(req.body[field]);
      userParam++;
    }
  }

  const profileSets = [];
  const profileValues = [];
  let profileParam = 1;

  for (const field of profileFields) {
    if (req.body[field] !== undefined) {
      profileSets.push(`${field} = $${profileParam}`);
      profileValues.push(req.body[field]);
      profileParam++;
    }
  }

  if (userSets.length === 0 && profileSets.length === 0) {
    return res.status(400).json({
      error: 'Debes enviar al menos un campo para actualizar',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si el email ya está en uso por otro usuario
    if (req.body.email) {
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL",
        [req.body.email, id]
      );
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'El correo electrónico ya está en uso por otra cuenta',
        });
      }
    }

    // Verificar que el cliente existe
    const existsCheck = await client.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'client' AND deleted_at IS NULL",
      [id]
    );

    if (existsCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    // Actualizar users solo si hay campos
    if (userSets.length > 0) {
      userSets.push('updated_at = NOW()');
      userValues.push(id);

      await client.query(
        `UPDATE users SET ${userSets.join(', ')} WHERE id = $${userParam}`,
        userValues
      );
    }

    // Actualizar client_profiles solo si hay campos
    if (profileSets.length > 0) {
      profileSets.push('updated_at = NOW()');
      profileValues.push(id);

      await client.query(
        `UPDATE client_profiles SET ${profileSets.join(', ')} WHERE user_id = $${profileParam}`,
        profileValues
      );
    }

    await client.query('COMMIT');

    // Retornar el cliente actualizado con su perfil
    const updatedResult = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    return res.status(200).json({
      data: { client: updatedResult.rows[0] },
      message: 'Perfil actualizado exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en updateProfile clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/clients/:id/deactivate
// Desactiva un cliente (is_active = FALSE). Solo admin.
// -----------------------------------------------------------
const deactivate = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE users
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND role = 'client' AND deleted_at IS NULL
       RETURNING id, first_name, last_name, email, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { client: result.rows[0] },
      message: 'Cliente desactivado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en deactivate clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/clients/:id/activate
// Reactiva un cliente (is_active = TRUE). Solo admin.
// -----------------------------------------------------------
const activate = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE users
       SET is_active = TRUE, updated_at = NOW()
       WHERE id = $1 AND role = 'client' AND deleted_at IS NULL
       RETURNING id, first_name, last_name, email, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { client: result.rows[0] },
      message: 'Cliente activado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en activate clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/clients/:id
// Soft delete (deleted_at = NOW()). Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE users
       SET deleted_at = NOW()
       WHERE id = $1 AND role = 'client' AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Cliente eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/clients/:id/photo
// Sube y actualiza la foto de perfil del cliente.
// -----------------------------------------------------------
const uploadPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que venga el archivo
    if (!req.file) {
      return res.status(400).json({
        error: 'No se ha enviado ningún archivo',
      });
    }

    const photoUrl = req.file.path; // Cloudinary inyecta la URL aquí

    // Actualizar client_profiles
    const result = await pool.query(
      `UPDATE client_profiles
       SET photo_url = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING photo_url`,
      [photoUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Perfil de cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { photo_url: result.rows[0].photo_url },
      message: 'Foto actualizada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en uploadPhoto clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, updateProfile, activate, deactivate, remove, uploadPhoto };
