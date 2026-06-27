// ============================================================
// workshops.controller.js — CRUD de talleres
// ============================================================
// Funciones: getAll, getById, create, update, remove (soft)
// Incluye manejo de tabla pivote workshop_instructors.
// Todas usan try/catch y formato de respuesta consistente:
//   Éxito: { data: {...}, message: "..." }
//   Error: { error: "mensaje descriptivo" }
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// Helper: obtiene un taller con sus instructores agrupados
// En MySQL no hay json_agg FILTER, así que se hace con
// una sub-query o bien con una segunda consulta.
// -----------------------------------------------------------
const fetchWorkshopWithInstructors = async (workshopId) => {
  const [[workshopRows], [instructorRows]] = await Promise.all([
    pool.query(
      `SELECT id, name, description, type,
              starts_at, duration_minutes, max_capacity,
              price,
              image_urls, status, created_at, updated_at
       FROM workshops
       WHERE id = ? AND deleted_at IS NULL`,
      [workshopId]
    ),
    pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM workshop_instructors wi
       JOIN users u ON u.id = wi.instructor_id
       WHERE wi.workshop_id = ?`,
      [workshopId]
    ),
  ]);

  if (workshopRows.length === 0) return null;

  return {
    ...workshopRows[0],
    instructors: instructorRows,
  };
};

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
    const conditions = ['workshops.deleted_at IS NULL'];
    const values = [];

    let therapistJoin = '';
    if (req.user?.role === 'therapist') {
      therapistJoin = 'JOIN workshop_instructors wi ON wi.workshop_id = workshops.id';
      conditions.push(`wi.instructor_id = ?`);
      values.push(req.user?.id);
    }

    if (status) {
      conditions.push(`workshops.status = ?`);
      values.push(status);
    }

    const whereClause = conditions.join(' AND ');

    // Total de registros
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM workshops ${therapistJoin} WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros de la página actual
    const [dataRows] = await pool.query(
      `SELECT workshops.id, name, description, type, starts_at,
              duration_minutes, max_capacity, price,
              image_urls, status, created_at, updated_at
       FROM workshops
       ${therapistJoin}
       WHERE ${whereClause}
       ORDER BY starts_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        workshops: dataRows,
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
// Retorna un taller por ID con sus instructores.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const workshop = await fetchWorkshopWithInstructors(id);

    if (!workshop) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    return res.status(200).json({
      data: { workshop },
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
    name, description, type, starts_at, duration_minutes,
    max_capacity, price, image_urls, status,
    instructor_ids,
  } = req.body;

  // Validación de campos obligatorios
  if (!name || !type || !starts_at || max_capacity == null || price == null) {
    return res.status(400).json({
      error: 'Los campos name, type, starts_at, max_capacity y price son obligatorios',
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Insertar taller
    const workshopId = crypto.randomUUID();

    await conn.query(
      `INSERT INTO workshops (id, name, description, type, starts_at, duration_minutes,
                              max_capacity, price, image_urls, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workshopId,
        name,
        description || null,
        type,
        starts_at,
        duration_minutes || null,
        max_capacity,
        price,
        image_urls ? JSON.stringify(image_urls) : null,
        status || 'draft',
      ]
    );

    // Insertar instructores si vienen en el body
    if (Array.isArray(instructor_ids) && instructor_ids.length > 0) {
      for (const instructorId of instructor_ids) {
        await conn.query(
          `INSERT INTO workshop_instructors (workshop_id, instructor_id)
           VALUES (?, ?)`,
          [workshopId, instructorId]
        );
      }
    }

    if (req.user?.role === 'therapist') {
      if (!Array.isArray(instructor_ids) || !instructor_ids.includes(req.user?.id)) {
        await conn.query(
          `INSERT INTO workshop_instructors (workshop_id, instructor_id)
           VALUES (?, ?)`,
          [workshopId, req.user?.id]
        );
      }
    }

    await conn.query('COMMIT');

    // Obtener el taller completo con sus instructores
    const fullWorkshop = await fetchWorkshopWithInstructors(workshopId);

    return res.status(201).json({
      data: { workshop: fullWorkshop },
      message: 'Taller creado exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en create workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
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
    'name', 'description', 'type', 'starts_at', 'duration_minutes',
    'max_capacity', 'price', 'image_urls', 'status',
  ];

  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      if (field === 'image_urls') {
        values.push(JSON.stringify(req.body[field]));
      } else {
        values.push(req.body[field]);
      }
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

  if (req.user?.role === 'therapist') {
    const [instructorCheck] = await pool.query(
      'SELECT instructor_id FROM workshop_instructors WHERE workshop_id = ? AND instructor_id = ?',
      [id, req.user?.id]
    );
    if (instructorCheck.length === 0) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este taller' });
    }
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar que el taller existe
    const [existsCheck] = await conn.query(
      'SELECT id FROM workshops WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existsCheck.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    // Actualizar campos del taller si los hay
    if (hasFieldUpdates) {
      setClauses.push('updated_at = NOW()');
      values.push(id);

      await conn.query(
        `UPDATE workshops
         SET ${setClauses.join(', ')}
         WHERE id = ? AND deleted_at IS NULL`,
        values
      );
    } else {
      // Si solo actualizan instructores, igualmente tocar updated_at
      await conn.query(
        'UPDATE workshops SET updated_at = NOW() WHERE id = ?',
        [id]
      );
    }

    // Reemplazar instructores si vienen en el body
    if (hasInstructorUpdates) {
      // Borrar instructores actuales
      await conn.query(
        'DELETE FROM workshop_instructors WHERE workshop_id = ?',
        [id]
      );

      // Insertar los nuevos
      const instructorIds = req.body.instructor_ids;
      if (Array.isArray(instructorIds)) {
        for (const instructorId of instructorIds) {
          await conn.query(
            `INSERT INTO workshop_instructors (workshop_id, instructor_id)
             VALUES (?, ?)`,
            [id, instructorId]
          );
        }
      }
    }

    await conn.query('COMMIT');

    // Obtener el taller actualizado con instructores
    const updatedWorkshop = await fetchWorkshopWithInstructors(id);

    return res.status(200).json({
      data: { workshop: updatedWorkshop },
      message: 'Taller actualizado exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en update workshops:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/workshops/:id
// Soft delete: actualiza deleted_at = NOW() en lugar de borrar.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'therapist') {
      const [instructorCheck] = await pool.query(
        'SELECT instructor_id FROM workshop_instructors WHERE workshop_id = ? AND instructor_id = ?',
        [id, req.user?.id]
      );
      if (instructorCheck.length === 0) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar este taller' });
      }
    }

    const [result] = await pool.query(
      `UPDATE workshops
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
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
// Reprograma un taller actualizando starts_at.
// Solo admin / therapist.
// -----------------------------------------------------------
const reschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { starts_at } = req.body;

    // Validar campo obligatorio
    if (!starts_at) {
      return res.status(400).json({
        error: 'El campo starts_at es obligatorio',
      });
    }

    // Validar que sea fecha válida
    const parsedStart = new Date(starts_at);

    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({
        error: 'El campo starts_at debe ser una fecha válida',
      });
    }

    // Buscar el taller
    const [current] = await pool.query(
      `SELECT id, status FROM workshops WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (current.length === 0) {
      return res.status(404).json({
        error: 'Taller no encontrado',
      });
    }

    if (req.user?.role === 'therapist') {
      const [instructorCheck] = await pool.query(
        'SELECT instructor_id FROM workshop_instructors WHERE workshop_id = ? AND instructor_id = ?',
        [id, req.user?.id]
      );
      if (instructorCheck.length === 0) {
        return res.status(403).json({ error: 'No tienes permisos para reprogramar este taller' });
      }
    }

    // Regla de negocio: no reprogramar si cancelado o finalizado
    const { status } = current[0];
    if (status === 'cancelled' || status === 'finished') {
      return res.status(400).json({
        error: 'No se puede reprogramar un taller cancelado o finalizado',
      });
    }

    // Actualizar fecha
    await pool.query(
      `UPDATE workshops
       SET starts_at = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [parsedStart.toISOString(), id]
    );

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, name, description, type, starts_at, duration_minutes,
              max_capacity, price,
              image_urls, status, created_at, updated_at
       FROM workshops WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { workshop: rows[0] },
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
