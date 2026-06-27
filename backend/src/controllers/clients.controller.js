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
                   u.\`role\`, u.is_active, u.created_at, u.updated_at`;

// Perfil como objeto JSON anidado (MySQL equivalente usando JSON_OBJECT)
const PROFILE_OBJ = `JSON_OBJECT(
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
    const conditions = ["u.`role` = 'client'", 'u.deleted_at IS NULL'];
    const values = [];

    if (req.user.role === 'therapist') {
      conditions.push(`u.id IN (
        SELECT DISTINCT r.client_id 
        FROM reservations r
        WHERE r.therapist_id = ?
        AND r.deleted_at IS NULL
        AND r.client_id IS NOT NULL
      )`);
      values.push(req.user.id);
    }

    if (search) {
      conditions.push(
        `(CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.email LIKE ?)`
      );
      values.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros paginados
    const [dataRows] = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    // Mapear booleanos y parsear profile JSON
    const clients = dataRows.map(r => ({
      ...r,
      is_active: !!r.is_active,
      profile: typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile,
    }));

    return res.status(200).json({
      data: {
        clients,
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
      const [resCheck] = await pool.query(
        `SELECT id FROM reservations WHERE client_id = ? AND therapist_id = ? AND deleted_at IS NULL`,
        [id, req.user.id]
      );
      if (resCheck.length === 0) {
        return res.status(403).json({
          error: 'No tienes acceso al expediente de este cliente',
        });
      }
    }

    const [rows] = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = ? AND u.\`role\` = 'client' AND u.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    const clientRow = {
      ...rows[0],
      is_active: !!rows[0].is_active,
      profile: typeof rows[0].profile === 'string' ? JSON.parse(rows[0].profile) : rows[0].profile,
    };

    // Obtener historial de reservas del cliente
    const [historyRows] = await pool.query(
      `SELECT r.id, r.scheduled_at, r.status, r.notes,
              s.name AS service_name,
              w.name AS workshop_name
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.client_id = ? AND r.deleted_at IS NULL
       ORDER BY r.scheduled_at DESC`,
      [id]
    );

    return res.status(200).json({
      data: {
        client: clientRow,
        reservation_history: historyRows,
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

  for (const field of userFields) {
    if (req.body[field] !== undefined) {
      userSets.push(`${field} = ?`);
      userValues.push(req.body[field]);
    }
  }

  const profileSets = [];
  const profileValues = [];

  for (const field of profileFields) {
    if (req.body[field] !== undefined) {
      profileSets.push(`${field} = ?`);
      profileValues.push(req.body[field]);
    }
  }

  if (userSets.length === 0 && profileSets.length === 0) {
    return res.status(400).json({
      error: 'Debes enviar al menos un campo para actualizar',
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar si el email ya está en uso por otro usuario
    if (req.body.email) {
      const [emailCheck] = await conn.query(
        "SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL",
        [req.body.email, id]
      );
      if (emailCheck.length > 0) {
        await conn.query('ROLLBACK');
        return res.status(400).json({
          error: 'El correo electrónico ya está en uso por otra cuenta',
        });
      }
    }

    // Verificar que el cliente existe
    const [existsCheck] = await conn.query(
      "SELECT id FROM users WHERE id = ? AND `role` = 'client' AND deleted_at IS NULL",
      [id]
    );

    if (existsCheck.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    // Actualizar users solo si hay campos
    if (userSets.length > 0) {
      userSets.push('updated_at = NOW()');
      userValues.push(id);

      await conn.query(
        `UPDATE users SET ${userSets.join(', ')} WHERE id = ?`,
        userValues
      );
    }

    // Actualizar client_profiles solo si hay campos
    if (profileSets.length > 0) {
      profileSets.push('updated_at = NOW()');
      profileValues.push(id);

      await conn.query(
        `UPDATE client_profiles SET ${profileSets.join(', ')} WHERE user_id = ?`,
        profileValues
      );
    }

    await conn.query('COMMIT');

    // Retornar el cliente actualizado con su perfil
    const [updatedRows] = await pool.query(
      `SELECT ${USER_COLS},
              ${PROFILE_OBJ}
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.id = ?`,
      [id]
    );

    const client = {
      ...updatedRows[0],
      is_active: !!updatedRows[0].is_active,
      profile: typeof updatedRows[0].profile === 'string' ? JSON.parse(updatedRows[0].profile) : updatedRows[0].profile,
    };

    return res.status(200).json({
      data: { client },
      message: 'Perfil actualizado exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en updateProfile clients:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/clients/:id/deactivate
// Desactiva un cliente (is_active = FALSE). Solo admin.
// -----------------------------------------------------------
const deactivate = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE users
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = ? AND \`role\` = 'client' AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, is_active FROM users WHERE id = ?`,
      [id]
    );

    const client = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { client },
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

    const [result] = await pool.query(
      `UPDATE users
       SET is_active = TRUE, updated_at = NOW()
       WHERE id = ? AND \`role\` = 'client' AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, is_active FROM users WHERE id = ?`,
      [id]
    );

    const client = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { client },
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

    const [result] = await pool.query(
      `UPDATE users
       SET deleted_at = NOW()
       WHERE id = ? AND \`role\` = 'client' AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
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
    const [result] = await pool.query(
      `UPDATE client_profiles
       SET photo_url = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [photoUrl, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Perfil de cliente no encontrado',
      });
    }

    return res.status(200).json({
      data: { photo_url: photoUrl },
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
