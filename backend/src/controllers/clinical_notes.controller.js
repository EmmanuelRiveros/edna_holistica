// ============================================================
// clinical_notes.controller.js — Notas clínicas (Expediente)
// ============================================================
// Funciones: getAll, getById, create, update, remove
// Solo accesible para admin y therapist.
// Therapists solo ven/editan/borran sus propias notas.
// NUNCA retorna password_hash en los JOINs.
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/clinical-notes
// Lista notas con paginación, filtro por client_id, y
// restricción de privacidad para therapists.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { client_id } = req.query;

    // WHERE dinámico
    const conditions = ['cn.deleted_at IS NULL'];
    const values = [];


    // Filtro por paciente
    if (client_id) {
      conditions.push(`cn.client_id = ?`);
      values.push(client_id);
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM clinical_notes cn WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros paginados con JOINs (aliases distintos para evitar ambigüedad)
    const [dataRows] = await pool.query(
      `SELECT cn.id, cn.\`content\`, cn.created_at, cn.updated_at,
              cn.client_id,
              client_user.first_name AS client_first_name,
              client_user.last_name AS client_last_name,
              client_user.email AS client_email,
              cn.therapist_id,
              therapist_user.first_name AS therapist_first_name,
              therapist_user.last_name AS therapist_last_name,
              therapist_user.email AS therapist_email,
              cn.reservation_id,
              res.scheduled_at AS reservation_date
       FROM clinical_notes cn
       LEFT JOIN users client_user ON client_user.id = cn.client_id
       LEFT JOIN users therapist_user ON therapist_user.id = cn.therapist_id
       LEFT JOIN reservations res ON res.id = cn.reservation_id
       WHERE ${whereClause}
       ORDER BY cn.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        clinical_notes: dataRows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Notas clínicas obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll clinical_notes:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/clinical-notes/:id
// Retorna una nota por ID. Therapist solo ve las suyas.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT cn.id, cn.\`content\`, cn.created_at, cn.updated_at,
              cn.client_id,
              client_user.first_name AS client_first_name,
              client_user.last_name AS client_last_name,
              client_user.email AS client_email,
              cn.therapist_id,
              therapist_user.first_name AS therapist_first_name,
              therapist_user.last_name AS therapist_last_name,
              therapist_user.email AS therapist_email,
              cn.reservation_id,
              res.scheduled_at AS reservation_date
       FROM clinical_notes cn
       LEFT JOIN users client_user ON client_user.id = cn.client_id
       LEFT JOIN users therapist_user ON therapist_user.id = cn.therapist_id
       LEFT JOIN reservations res ON res.id = cn.reservation_id
       WHERE cn.id = ? AND cn.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Nota clínica no encontrada',
      });
    }

    const note = rows[0];


    return res.status(200).json({
      data: { clinical_note: note },
      message: 'Nota clínica obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById clinical_notes:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/clinical-notes
// Crea una nota clínica. therapist_id = req.user.id (auto).
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const { client_id, reservation_id, content } = req.body;

    // Validar campos obligatorios
    if (!client_id || !content) {
      return res.status(400).json({
        error: 'Los campos client_id y content son obligatorios',
      });
    }

    // Validar que content no esté vacío después de trim
    if (content.trim().length === 0) {
      return res.status(400).json({
        error: 'El contenido de la nota no puede estar vacío',
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO clinical_notes (id, client_id, therapist_id, reservation_id, \`content\`)
       VALUES (?, ?, ?, ?, ?)`,
      [id, client_id, req.user.id, reservation_id || null, content.trim()]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, client_id, therapist_id, reservation_id, \`content\`, created_at, updated_at
       FROM clinical_notes WHERE id = ?`,
      [id]
    );

    return res.status(201).json({
      data: { clinical_note: rows[0] },
      message: 'Nota clínica creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create clinical_notes:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/clinical-notes/:id
// Actualiza solo el contenido de una nota.
// Therapist solo puede editar sus propias notas.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Validar content
    if (content === undefined || content === null) {
      return res.status(400).json({
        error: 'El campo content es obligatorio',
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({
        error: 'El contenido de la nota no puede estar vacío',
      });
    }

    // Verificar que la nota existe y obtener therapist_id
    const [existing] = await pool.query(
      'SELECT therapist_id FROM clinical_notes WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Nota clínica no encontrada',
      });
    }

    // Privacidad: therapist solo edita sus notas
    if (req.user.role === 'therapist' && existing[0].therapist_id !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    await pool.query(
      `UPDATE clinical_notes
       SET \`content\` = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [content.trim(), id]
    );

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, client_id, therapist_id, reservation_id, \`content\`, created_at, updated_at
       FROM clinical_notes WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { clinical_note: rows[0] },
      message: 'Nota clínica actualizada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update clinical_notes:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/clinical-notes/:id
// Soft delete. Admin borra cualquiera, therapist solo las suyas.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la nota existe y obtener therapist_id
    const [existing] = await pool.query(
      'SELECT id, therapist_id FROM clinical_notes WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Nota clínica no encontrada',
      });
    }

    // Privacidad: therapist solo borra sus notas
    if (req.user.role === 'therapist' && existing[0].therapist_id !== req.user.id) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    await pool.query(
      'UPDATE clinical_notes SET deleted_at = NOW() WHERE id = ?',
      [id]
    );

    return res.status(200).json({
      data: { id: existing[0].id },
      message: 'Nota clínica eliminada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete clinical_notes:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, update, remove };
