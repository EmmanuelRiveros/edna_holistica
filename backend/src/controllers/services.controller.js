// ============================================================
// services.controller.js — CRUD de servicios
// ============================================================
// Funciones: getAll, getById, create, update, delete (soft)
// Todas usan try/catch y formato de respuesta consistente:
//   Éxito: { data: {...}, message: "..." }
//   Error: { error: "mensaje descriptivo" }
// ============================================================

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
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM services WHERE deleted_at IS NULL'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros de la página actual
    const dataResult = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              price::FLOAT AS price, is_active, created_at, updated_at
       FROM services
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.status(200).json({
      data: {
        services: dataResult.rows,
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

    const result = await pool.query(
      `SELECT id, name, description, benefits, duration_minutes,
              price::FLOAT AS price, is_active, created_at, updated_at
       FROM services
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    return res.status(200).json({
      data: { service: result.rows[0] },
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
    const { name, description, benefits, duration_minutes, price, is_active } = req.body;

    // Validación de campos obligatorios
    if (!name || duration_minutes == null || price == null) {
      return res.status(400).json({
        error: 'Los campos name, duration_minutes y price son obligatorios',
      });
    }

    const result = await pool.query(
      `INSERT INTO services (name, description, benefits, duration_minutes, price, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, benefits, duration_minutes,
                price::FLOAT AS price, is_active, created_at, updated_at`,
      [
        name,
        description || null,
        benefits || null,
        duration_minutes,
        price,
        is_active != null ? is_active : true,
      ]
    );

    return res.status(201).json({
      data: { service: result.rows[0] },
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
    const allowedFields = ['name', 'description', 'benefits', 'duration_minutes', 'price', 'is_active'];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
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

    const query = `
      UPDATE services
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING id, name, description, benefits, duration_minutes,
               price::FLOAT AS price, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    return res.status(200).json({
      data: { service: result.rows[0] },
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

    const result = await pool.query(
      `UPDATE services
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, price::FLOAT AS price`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Servicio eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, update, remove };
