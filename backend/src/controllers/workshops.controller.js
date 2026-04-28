// ============================================================
// workshops.controller.js — CRUD de talleres
// ============================================================
// Funciones: getAll, getById, create, update, remove (soft)
// Incluye manejo de tabla pivote workshop_instructors.
// Todas usan try/catch y formato de respuesta consistente:
//   Éxito: { data: {...}, message: "..." }
//   Error: { error: "mensaje descriptivo" }
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/workshops
// Retorna talleres activos con paginación y filtro por status.
// Query params: ?page=1&limit=20&status=published
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 100, 1);
    const offset = (page - 1) * limit;
    const { status } = req.query;

    // Construir WHERE dinámico
    const conditions = ['deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total de registros
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM workshops WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros de la página actual
    const dataResult = await pool.query(
      `SELECT id, name, description, type, starts_at, ends_at,
              max_capacity, price::FLOAT AS price, materials,
              image_urls, status, created_at, updated_at
       FROM workshops
       WHERE ${whereClause}
       ORDER BY starts_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        workshops: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Talleres obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/workshops/:id
// Retorna un taller por ID con sus instructores (LEFT JOIN).
// Usa json_agg + json_build_object para devolver instructors
// como array de objetos JSON en una sola fila.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT w.id, w.name, w.description, w.type,
              w.starts_at, w.ends_at, w.max_capacity,
              w.price::FLOAT AS price, w.materials,
              w.image_urls, w.status, w.created_at, w.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email
                  )
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'
              ) AS instructors
       FROM workshops w
       LEFT JOIN workshop_instructors wi ON wi.workshop_id = w.id
       LEFT JOIN users u ON u.id = wi.instructor_id
       WHERE w.id = $1 AND w.deleted_at IS NULL
       GROUP BY w.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    return res.status(200).json({
      data: { workshop: result.rows[0] },
      message: 'Taller obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/workshops
// Crea un nuevo taller. Usa transacción para insertar el
// taller y opcionalmente sus instructores en la tabla pivote.
// -----------------------------------------------------------
const create = async (req, res) => {
  const {
    name, description, type, starts_at, ends_at,
    max_capacity, price, materials, image_urls, status,
    instructor_ids,
  } = req.body;

  // Validación de campos obligatorios
  if (!name || !type || !starts_at || !ends_at || max_capacity == null || price == null) {
    return res.status(400).json({
      error: 'Los campos name, type, starts_at, ends_at, max_capacity y price son obligatorios',
    });
  }

  // Validar que ends_at > starts_at
  if (new Date(ends_at) <= new Date(starts_at)) {
    return res.status(400).json({
      error: 'La fecha de fin (ends_at) debe ser posterior a la fecha de inicio (starts_at)',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insertar taller
    const workshopResult = await client.query(
      `INSERT INTO workshops (name, description, type, starts_at, ends_at,
                              max_capacity, price, materials, image_urls, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::TEXT[], $10)
       RETURNING id, name, description, type, starts_at, ends_at,
                max_capacity, price::FLOAT AS price, materials,
                image_urls, status, created_at, updated_at`,
      [
        name,
        description || null,
        type,
        starts_at,
        ends_at,
        max_capacity,
        price,
        materials || null,
        image_urls || null,
        status || 'draft',
      ]
    );

    const newWorkshop = workshopResult.rows[0];

    // Insertar instructores si vienen en el body
    if (Array.isArray(instructor_ids) && instructor_ids.length > 0) {
      for (const instructorId of instructor_ids) {
        await client.query(
          `INSERT INTO workshop_instructors (workshop_id, instructor_id)
           VALUES ($1, $2)`,
          [newWorkshop.id, instructorId]
        );
      }
    }

    await client.query('COMMIT');

    // Obtener el taller completo con sus instructores (mismo query de getById)
    const fullWorkshop = await pool.query(
      `SELECT w.id, w.name, w.description, w.type,
              w.starts_at, w.ends_at, w.max_capacity,
              w.price::FLOAT AS price, w.materials,
              w.image_urls, w.status, w.created_at, w.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email
                  )
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'
              ) AS instructors
       FROM workshops w
       LEFT JOIN workshop_instructors wi ON wi.workshop_id = w.id
       LEFT JOIN users u ON u.id = wi.instructor_id
       WHERE w.id = $1
       GROUP BY w.id`,
      [newWorkshop.id]
    );

    return res.status(201).json({
      data: { workshop: fullWorkshop.rows[0] },
      message: 'Taller creado exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en create workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// PUT /api/v1/workshops/:id
// Actualiza solo los campos enviados en el body.
// Usa transacción para actualizar taller + instructores.
// -----------------------------------------------------------
const update = async (req, res) => {
  const { id } = req.params;

  // Campos permitidos para actualizar
  const allowedFields = [
    'name', 'description', 'type', 'starts_at', 'ends_at',
    'max_capacity', 'price', 'materials', 'image_urls', 'status',
  ];

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === 'image_urls') {
        setClauses.push(`${field} = $${paramIndex}::TEXT[]`);
      } else {
        setClauses.push(`${field} = $${paramIndex}`);
      }
      values.push(req.body[field]);
      paramIndex++;
    }
  }

  const hasFieldUpdates = setClauses.length > 0;
  const hasInstructorUpdates = req.body.instructor_ids !== undefined;

  // Si no se envió nada para actualizar
  if (!hasFieldUpdates && !hasInstructorUpdates) {
    return res.status(400).json({
      error: 'Debes enviar al menos un campo para actualizar',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que el taller existe
    const existsCheck = await client.query(
      'SELECT id FROM workshops WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existsCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    // Actualizar campos del taller si los hay
    if (hasFieldUpdates) {
      setClauses.push('updated_at = NOW()');
      values.push(id);

      const query = `
        UPDATE workshops
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
      `;

      await client.query(query, values);
    } else {
      // Si solo actualizan instructores, igualmente tocar updated_at
      await client.query(
        'UPDATE workshops SET updated_at = NOW() WHERE id = $1',
        [id]
      );
    }

    // Reemplazar instructores si vienen en el body
    if (hasInstructorUpdates) {
      // Borrar instructores actuales
      await client.query(
        'DELETE FROM workshop_instructors WHERE workshop_id = $1',
        [id]
      );

      // Insertar los nuevos
      const instructorIds = req.body.instructor_ids;
      if (Array.isArray(instructorIds)) {
        for (const instructorId of instructorIds) {
          await client.query(
            `INSERT INTO workshop_instructors (workshop_id, instructor_id)
             VALUES ($1, $2)`,
            [id, instructorId]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Obtener el taller actualizado con instructores
    const updatedResult = await pool.query(
      `SELECT w.id, w.name, w.description, w.type,
              w.starts_at, w.ends_at, w.max_capacity,
              w.price::FLOAT AS price, w.materials,
              w.image_urls, w.status, w.created_at, w.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email
                  )
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'
              ) AS instructors
       FROM workshops w
       LEFT JOIN workshop_instructors wi ON wi.workshop_id = w.id
       LEFT JOIN users u ON u.id = wi.instructor_id
       WHERE w.id = $1
       GROUP BY w.id`,
      [id]
    );

    return res.status(200).json({
      data: { workshop: updatedResult.rows[0] },
      message: 'Taller actualizado exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en update workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/workshops/:id
// Soft delete: actualiza deleted_at = NOW() en lugar de borrar.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE workshops
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Taller eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/workshops/:id/reschedule
// Reprograma un taller actualizando starts_at y ends_at.
// Solo admin / therapist.
// -----------------------------------------------------------
const reschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { starts_at, ends_at } = req.body;

    // Validar campos obligatorios
    if (!starts_at || !ends_at) {
      return res.status(400).json({
        error: 'Los campos starts_at y ends_at son obligatorios',
      });
    }

    // Validar que sean fechas válidas
    const parsedStart = new Date(starts_at);
    const parsedEnd = new Date(ends_at);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({
        error: 'Los campos starts_at y ends_at deben ser fechas válidas',
      });
    }

    // Regla de negocio 1: ends_at > starts_at
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({
        error: 'La fecha de fin (ends_at) debe ser posterior a la fecha de inicio (starts_at)',
      });
    }

    // Buscar el taller
    const current = await pool.query(
      `SELECT id, status FROM workshops WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    // Regla de negocio 2: no reprogramar si cancelado o finalizado
    const { status } = current.rows[0];
    if (status === 'cancelled' || status === 'finished') {
      return res.status(400).json({
        error: 'No se puede reprogramar un taller cancelado o finalizado',
      });
    }

    // Actualizar fechas
    const result = await pool.query(
      `UPDATE workshops
       SET starts_at = $1, ends_at = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, name, description, type, starts_at, ends_at,
                max_capacity, price::FLOAT AS price, materials,
                image_urls, status, created_at, updated_at`,
      [parsedStart.toISOString(), parsedEnd.toISOString(), id]
    );

    return res.status(200).json({
      data: { workshop: result.rows[0] },
      message: 'Taller reprogramado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en reschedule workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, update, reschedule, remove };
