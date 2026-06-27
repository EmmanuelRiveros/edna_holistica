// ============================================================
// services.controller.js — CRUD de servicios
// ============================================================
// Funciones: getAll, getById, create, update, delete (soft)
// Todas usan try/catch y formato de respuesta consistente:
//   Éxito: { data: {...}, message: "..." }
//   Error: { error: "mensaje descriptivo" }
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/services
// Retorna servicios activos (deleted_at IS NULL) con paginación.
// Query params: ?page=1&limit=20
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 100, 1);
    const offset = (page - 1) * limit;

    // Total de registros (para paginador del frontend)
    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM services WHERE deleted_at IS NULL'
    );
    const total = countResult[0].total;

    // Registros de la página actual
    const [dataRows] = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              buffer_minutes, price, 
              deposit_amount, is_active,
              created_at, updated_at
       FROM services
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Mapear booleanos
    const services = dataRows.map(r => ({ ...r, is_active: !!r.is_active }));

    return res.status(200).json({
      data: {
        services,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Servicios obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/services/:id
// Retorna un servicio por ID (deleted_at IS NULL).
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              buffer_minutes, price, 
              deposit_amount, is_active,
              created_at, updated_at
       FROM services
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    const service = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { service },
      message: 'Servicio obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/services
// Crea un nuevo servicio. Requiere name, duration_minutes y
// price en el body.
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const { name, description, benefits, duration_minutes, buffer_minutes, price, deposit_amount, is_active } = req.body;

    // Validación de campos obligatorios
    if (!name || duration_minutes == null || price == null) {
      return res.status(400).json({
        error: 'Los campos name, duration_minutes y price son obligatorios',
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO services (id, name, description, benefits, duration_minutes, buffer_minutes, price, deposit_amount, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        description || null,
        benefits || null,
        duration_minutes,
        buffer_minutes != null ? buffer_minutes : 15,
        price,
        deposit_amount != null ? deposit_amount : 0,
        is_active != null ? is_active : true,
      ]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              buffer_minutes, price, 
              deposit_amount, is_active,
              created_at, updated_at
       FROM services WHERE id = ?`,
      [id]
    );

    const service = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(201).json({
      data: { service },
      message: 'Servicio creado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/services/:id
// Actualiza solo los campos que vengan en el body.
// Construye el SET dinámicamente para ignorar campos undefined.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;

    // Campos permitidos para actualizar
    const allowedFields = ['name', 'description', 'benefits', 'duration_minutes', 'buffer_minutes', 'price', 'deposit_amount', 'is_active'];

    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    // Si no se envió ningún campo válido
    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'Debes enviar al menos un campo para actualizar',
      });
    }

    // Siempre actualizar updated_at
    setClauses.push(`updated_at = NOW()`);

    // El ID es el último parámetro
    values.push(id);

    const [result] = await pool.query(
      `UPDATE services
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              buffer_minutes, price, 
              deposit_amount, is_active,
              created_at, updated_at
       FROM services WHERE id = ?`,
      [id]
    );

    const service = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { service },
      message: 'Servicio actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/services/:id
// Soft delete: actualiza deleted_at = NOW() en lugar de borrar.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE services
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
      message: 'Servicio eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/services/:id/therapists
// Retorna los terapeutas y admins que ofrecen este servicio.
// -----------------------------------------------------------
const getTherapists = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el servicio existe
    const [serviceRows] = await pool.query(
      `SELECT id, name FROM services 
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({ 
        error: 'Servicio no encontrado' 
      });
    }

    // Obtener terapeutas asignados (therapist Y admin)
    const [rows] = await pool.query(
      `SELECT 
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM therapist_services ts
       JOIN users u ON u.id = ts.therapist_id
       WHERE ts.service_id = ?
         AND u.deleted_at IS NULL
         AND u.is_active = TRUE
         AND u.\`role\` IN ('therapist', 'admin')
       ORDER BY u.first_name ASC`,
      [id]
    );

    return res.status(200).json({
      data: { therapists: rows },
      message: 'Terapeutas obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en getTherapists:', error.message);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
};

module.exports = { getAll, getById, create, update, remove, getTherapists };
