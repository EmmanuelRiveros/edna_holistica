// ============================================================
// reservations.controller.js — CRUD de reservas
// ============================================================
// Funciones: getAll, getById, create, updateStatus, addNotes, remove
// Maneja reservas de servicios individuales y talleres grupales.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/reservations
// Lista reservas con paginación y filtros opcionales.
// Solo admin / therapist.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { status, client_id } = req.query;

    // WHERE dinámico
    const conditions = ['r.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    // Si el usuario es cliente, forzar que solo vea sus propias reservas
    if (req.user.role === 'client') {
      // Ignorar cualquier client_id que venga en el query
      // y forzar el filtro con su propio ID
      conditions.push(`r.client_id = $${paramIndex}`);
      values.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'therapist') {
      conditions.push(`r.therapist_id = $${paramIndex}`);
      values.push(req.user.id);
      paramIndex++;
      if (client_id) {
        conditions.push(`r.client_id = $${paramIndex}`);
        values.push(client_id);
        paramIndex++;
      }
    } else if (client_id) {
      conditions.push(`r.client_id = $${paramIndex}`);
      values.push(client_id);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reservations r WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros paginados con JOINs
    const dataResult = await pool.query(
      `SELECT r.id, r.scheduled_at, r.status, r.notes,
              r.created_at, r.updated_at,
              r.client_id, c.first_name AS client_first_name,
              c.last_name AS client_last_name, c.email AS client_email,
              r.therapist_id, t.first_name AS therapist_first_name,
              t.last_name AS therapist_last_name,
              r.service_id, s.name AS service_name,
              s.duration_minutes AS service_duration_minutes,
              r.workshop_id, w.name AS workshop_name
       FROM reservations r
       LEFT JOIN users c ON c.id = r.client_id
       LEFT JOIN users t ON t.id = r.therapist_id
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE ${whereClause}
       ORDER BY r.scheduled_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        reservations: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Reservas obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/reservations/:id
// Retorna una reserva con todos sus datos relacionados.
// Admin, therapist, o el cliente dueño.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT r.id, r.scheduled_at, r.status, r.notes,
              r.created_at, r.updated_at,
              r.client_id, c.first_name AS client_first_name,
              c.last_name AS client_last_name, c.email AS client_email,
              c.phone AS client_phone,
              r.therapist_id, t.first_name AS therapist_first_name,
              t.last_name AS therapist_last_name, t.email AS therapist_email,
              r.service_id, s.name AS service_name,
              s.duration_minutes, s.base_price::FLOAT AS service_price,
              r.workshop_id, w.name AS workshop_name,
              w.price::FLOAT AS workshop_price
       FROM reservations r
       LEFT JOIN users c ON c.id = r.client_id
       LEFT JOIN users t ON t.id = r.therapist_id
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    const reservation = result.rows[0];

    // Verificar permisos: admin, therapist, o el cliente dueño
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'therapist' &&
      req.user.id !== reservation.client_id
    ) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    return res.status(200).json({
      data: { reservation },
      message: 'Reserva obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/reservations
// Crea una nueva reserva. Usa transacción con bloqueo FOR
// UPDATE para verificar cupos en talleres.
// -----------------------------------------------------------
const create = async (req, res) => {
  const { 
    scheduled_at, service_id, workshop_id, therapist_id,
    payment_method,  // 'cash' | 'transfer' | 'paypal' | 'mercadopago'
    payment_type,    // 'full' | 'deposit'
  } = req.body;

  // Validar scheduled_at
  if (!scheduled_at) {
    return res.status(400).json({
      error: 'El campo scheduled_at es obligatorio',
    });
  }

  // Validar XOR: exactamente uno de service_id o workshop_id
  if ((!service_id && !workshop_id) || (service_id && workshop_id)) {
    return res.status(400).json({
      error: 'Debes enviar exactamente uno de service_id o workshop_id, nunca ambos ni ninguno',
    });
  }

  // El client_id depende del rol
  const clientId = req.user.role === 'admin' ? (req.body.client_id || req.user.id) : req.user.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    let depositAmount = 0;

    // Si es taller, verificar cupos con bloqueo de fila
    if (workshop_id) {
      // Bloquear la fila del taller (FOR UPDATE)
      const workshopResult = await client.query(
        'SELECT max_capacity, price::FLOAT, deposit_amount::FLOAT FROM workshops WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [workshop_id]
      );

      if (workshopResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Taller no encontrado',
        });
      }

      const maxCapacity = workshopResult.rows[0].max_capacity;
      totalAmount = parseFloat(workshopResult.rows[0].price || 0);
      depositAmount = parseFloat(workshopResult.rows[0].deposit_amount || 0);

      // Contar reservas activas del taller
      const activeCount = await client.query(
        `SELECT COUNT(*) FROM reservations
         WHERE workshop_id = $1 AND status != 'cancelled' AND deleted_at IS NULL`,
        [workshop_id]
      );

      const activeReservations = parseInt(activeCount.rows[0].count, 10);

      if (activeReservations >= maxCapacity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'El taller no tiene cupos disponibles',
        });
      }
    }

    if (service_id) {
      const serviceResult = await client.query(
        'SELECT price::FLOAT, deposit_amount::FLOAT FROM services WHERE id = $1 AND deleted_at IS NULL',
        [service_id]
      );
      if (serviceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Servicio no encontrado',
        });
      }
      totalAmount = parseFloat(serviceResult.rows[0].price || 0);
      depositAmount = parseFloat(serviceResult.rows[0].deposit_amount || 0);
    }

    // Calcular monto a pagar según payment_type
    const amountToPay = payment_type === 'deposit' && depositAmount > 0
      ? depositAmount
      : totalAmount;

    // Preparar notas de la reserva incluyendo información de pago
    let reservationNotes = req.body.notes || '';
    if (payment_method) {
      const payNotes = `Método de pago seleccionado: ${payment_method === 'cash' ? 'Efectivo' : payment_method === 'transfer' ? 'Transferencia' : payment_method}. Tipo: ${payment_type === 'deposit' ? 'Anticipo' : 'Pago Completo'}.`;
      reservationNotes = reservationNotes ? `${reservationNotes} | ${payNotes}` : payNotes;
    }

    // Insertar la reserva
    const insertResult = await client.query(
      `INSERT INTO reservations (client_id, therapist_id, service_id, workshop_id, scheduled_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, client_id, therapist_id, service_id, workshop_id,
                 scheduled_at, status, notes, created_at, updated_at`,
      [clientId, therapist_id || null, service_id || null, workshop_id || null, scheduled_at, reservationNotes || null]
    );

    // Si se especificó un método de pago, registrar en payments
    if (payment_method) {
      const isOffline = payment_method === 'cash' || payment_method === 'transfer';
      const paymentStatus = isOffline ? 'pending' : 'completed';
      const paidVal = isOffline ? 0 : totalAmount;

      await client.query(
        `INSERT INTO payments 
         (reservation_id, payment_method, status, 
          total_amount, paid_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          insertResult.rows[0].id,
          payment_method,
          paymentStatus,
          totalAmount,  // Siempre guardar el precio completo
          paidVal
        ]
      );
    }

    await client.query('COMMIT');

    const emailService = require('../services/email.service');
    // No await — no bloquear la respuesta
    emailService.sendNotification({ type: 'confirmation', data: insertResult.rows[0].id })
      .catch(err => console.error('Email error:', err));

    return res.status(201).json({
      data: { 
        reservation: insertResult.rows[0],
        payment: payment_method
          ? { 
              method: payment_method, 
              status: payment_method === 'cash' || payment_method === 'transfer' ? 'pending' : 'completed',
              total_amount: totalAmount,
              amount_due: payment_method === 'cash' || payment_method === 'transfer' ? amountToPay : 0
            }
          : null
      },
      message: 'Reserva creada exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en create reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/reservations/:id/status
// Actualiza el status de una reserva. Solo admin / therapist.
// -----------------------------------------------------------
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, cancellation_reason, notes, payment_method, payment_type } = req.body;

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `El status debe ser uno de: ${allowedStatuses.join(', ')}`,
      });
    }

    // Validación de política de cancelación (24 horas) exclusiva para clientes
    if (req.user.role === 'client' && status === 'cancelled') {
      const currentRes = await pool.query(
        'SELECT scheduled_at FROM reservations WHERE id = $1',
        [id]
      );

      if (currentRes.rows.length > 0) {
        const scheduledAt = currentRes.rows[0].scheduled_at;
        const hoursUntilAppointment = (new Date(scheduledAt) - new Date()) / (1000 * 60 * 60);

        if (hoursUntilAppointment < 24) {
          return res.status(400).json({
            error: 'No puedes cancelar una cita con menos de 24 horas de anticipación. Contacta directamente con el centro.',
          });
        }
      }
    }

    if (payment_method) {
      // Obtener el precio y depósito de la reserva
      const resDataResult = await pool.query(
        `SELECT r.id, r.notes,
                COALESCE(s.price, w.price, 0)::FLOAT AS price,
                COALESCE(s.deposit_amount, w.deposit_amount, 0)::FLOAT AS deposit_amount
         FROM reservations r
         LEFT JOIN services s ON s.id = r.service_id
         LEFT JOIN workshops w ON w.id = r.workshop_id
         WHERE r.id = $1 AND r.deleted_at IS NULL`,
        [id]
      );
      
      if (resDataResult.rows.length > 0) {
        const totalAmount = resDataResult.rows[0].price;
        const depositAmount = resDataResult.rows[0].deposit_amount;
        const amountToPay = payment_type === 'deposit' && depositAmount > 0
          ? depositAmount
          : totalAmount;

        const isOffline = payment_method === 'cash' || payment_method === 'transfer';
        const paymentStatus = isOffline ? 'pending' : 'completed';
        const paidVal = isOffline ? 0 : amountToPay;

        // Actualizar notas de la reserva
        const currentNotes = resDataResult.rows[0].notes || '';
        const payNotes = `Método de pago seleccionado: ${payment_method === 'cash' ? 'Efectivo' : payment_method === 'transfer' ? 'Transferencia' : payment_method}. Tipo: ${payment_type === 'deposit' ? 'Anticipo' : 'Pago Completo'}.`;
        const updatedNotes = currentNotes ? `${currentNotes} | ${payNotes}` : payNotes;

        // Si no se enviaron notas explícitas, usar las automáticas
        if (notes === undefined) {
          notes = updatedNotes;
        }

        // Crear o actualizar en payments
        const paymentCheck = await pool.query(
          'SELECT id FROM payments WHERE reservation_id = $1 AND deleted_at IS NULL',
          [id]
        );

        if (paymentCheck.rows.length > 0) {
          await pool.query(
            `UPDATE payments 
             SET payment_method = $1, status = $2, total_amount = $3, paid_amount = $4, updated_at = NOW()
             WHERE reservation_id = $5`,
            [payment_method, paymentStatus, totalAmount, paidVal, id]
          );
        } else {
          await pool.query(
            `INSERT INTO payments (reservation_id, payment_method, status, total_amount, paid_amount)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, payment_method, paymentStatus, totalAmount, paidVal]
          );
        }
      }
    }

    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    if (cancellation_reason !== undefined) {
      setClauses.push(`cancellation_reason = $${paramIndex}`);
      values.push(cancellation_reason);
      paramIndex++;
    }

    if (notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE reservations
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, client_id, therapist_id, service_id, workshop_id,
                 scheduled_at, status, cancellation_reason, notes, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    const emailService = require('../services/email.service');

    if (status === 'completed') {
      emailService.sendNotification({ type: 'thank_you', data: id })
        .catch(err => console.error('Email error:', err));

      setTimeout(() => {
        emailService.sendNotification({ type: 'feedback', data: id })
          .catch(err => console.error('Email error:', err));
      }, 60 * 60 * 1000);
    } else if (status === 'cancelled') {
      emailService.sendNotification({ type: 'cancellation', data: id })
        .catch(err => console.error('Email error:', err));
    }

    // 🟢 Al estar aislado el correo, esto se ejecutará SIEMPRE, regresando un 200 a tu frontend
    return res.status(200).json({
      data: { reservation: result.rows[0] },
      message: 'Status de reserva actualizado exitosamente',
    });

  } catch (error) {
    console.error('❌ Error en updateStatus reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/reservations/:id/notes
// Agrega notas post-sesión. Solo admin / therapist.
// -----------------------------------------------------------
const addNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (notes === undefined || notes === null) {
      return res.status(400).json({
        error: 'El campo notes es obligatorio',
      });
    }

    const result = await pool.query(
      `UPDATE reservations
       SET notes = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, client_id, therapist_id, service_id, workshop_id,
                 scheduled_at, status, notes, created_at, updated_at`,
      [notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    return res.status(200).json({
      data: { reservation: result.rows[0] },
      message: 'Notas actualizadas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en addNotes reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/reservations/:id
// Soft delete. Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE reservations
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Reserva eliminada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/reservations/:id/reschedule
// Reprograma una reserva actualizando scheduled_at.
// Solo admin / therapist.
// -----------------------------------------------------------
const reschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    // Validar campo obligatorio
    if (!scheduled_at) {
      return res.status(400).json({
        error: 'El campo scheduled_at es obligatorio',
      });
    }

    // Validar que sea una fecha válida
    const parsedDate = new Date(scheduled_at);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: 'El campo scheduled_at debe ser una fecha válida',
      });
    }

    // Buscar la reserva y verificar que exista
    const current = await pool.query(
      `SELECT id, status FROM reservations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    // Validar que no esté cancelada ni completada
    const { status } = current.rows[0];
    if (status === 'cancelled' || status === 'completed') {
      return res.status(400).json({
        error: `No se puede reprogramar una reserva con status "${status}"`,
      });
    }

    // Actualizar scheduled_at
    const result = await pool.query(
      `UPDATE reservations
       SET scheduled_at = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, client_id, therapist_id, service_id, workshop_id,
                 scheduled_at, status, notes, created_at, updated_at`,
      [parsedDate.toISOString(), id]
    );

    return res.status(200).json({
      data: { reservation: result.rows[0] },
      message: 'Reserva reprogramada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en reschedule reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, updateStatus, addNotes, reschedule, remove };
