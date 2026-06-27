// ============================================================
// reservations.controller.js — CRUD de reservas
// ============================================================
// Funciones: getAll, getById, create, updateStatus, addNotes, remove
// Maneja reservas de servicios individuales y talleres grupales.
// ============================================================

const crypto = require('crypto');
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

    if (status) {
      conditions.push(`r.status = ?`);
      values.push(status);
    }

    // Si el usuario es cliente, forzar que solo vea sus propias reservas
    if (req.user.role === 'client') {
      // Ignorar cualquier client_id que venga en el query
      // y forzar el filtro con su propio ID
      conditions.push(`r.client_id = ?`);
      values.push(req.user.id);
    } else if (req.user.role === 'therapist') {
      conditions.push(`r.therapist_id = ?`);
      values.push(req.user.id);
      if (client_id) {
        conditions.push(`r.client_id = ?`);
        values.push(client_id);
      }
    } else if (client_id) {
      conditions.push(`r.client_id = ?`);
      values.push(client_id);
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM reservations r WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros paginados con JOINs
    const [dataRows] = await pool.query(
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
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        reservations: dataRows,
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

    const [rows] = await pool.query(
      `SELECT r.id, r.scheduled_at, r.status, r.notes,
              r.created_at, r.updated_at,
              r.client_id, c.first_name AS client_first_name,
              c.last_name AS client_last_name, c.email AS client_email,
              c.phone AS client_phone,
              r.therapist_id, t.first_name AS therapist_first_name,
              t.last_name AS therapist_last_name, t.email AS therapist_email,
              r.service_id, s.name AS service_name,
              s.duration_minutes, s.base_price AS service_price,
              r.workshop_id, w.name AS workshop_name,
              w.price AS workshop_price
       FROM reservations r
       LEFT JOIN users c ON c.id = r.client_id
       LEFT JOIN users t ON t.id = r.therapist_id
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = ? AND r.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    const reservation = rows[0];

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

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    let totalAmount = 0;
    let depositAmount = 0;

    // Si es taller, verificar cupos con bloqueo de fila
    if (workshop_id) {
      // Bloquear la fila del taller (FOR UPDATE)
      const [workshopRows] = await conn.query(
        'SELECT max_capacity, price, deposit_amount FROM workshops WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [workshop_id]
      );

      if (workshopRows.length === 0) {
        await conn.query('ROLLBACK');
        return res.status(404).json({
          error: 'Taller no encontrado',
        });
      }

      const maxCapacity = workshopRows[0].max_capacity;
      totalAmount = parseFloat(workshopRows[0].price || 0);
      depositAmount = parseFloat(workshopRows[0].deposit_amount || 0);

      // Contar reservas activas del taller
      const [activeCount] = await conn.query(
        `SELECT COUNT(*) AS total FROM reservations
         WHERE workshop_id = ? AND status != 'cancelled' AND deleted_at IS NULL`,
        [workshop_id]
      );

      const activeReservations = activeCount[0].total;

      if (activeReservations >= maxCapacity) {
        await conn.query('ROLLBACK');
        return res.status(400).json({
          error: 'El taller no tiene cupos disponibles',
        });
      }
    }

    if (service_id) {
      const [serviceRows] = await conn.query(
        'SELECT price, deposit_amount FROM services WHERE id = ? AND deleted_at IS NULL',
        [service_id]
      );
      if (serviceRows.length === 0) {
        await conn.query('ROLLBACK');
        return res.status(404).json({
          error: 'Servicio no encontrado',
        });
      }
      totalAmount = parseFloat(serviceRows[0].price || 0);
      depositAmount = parseFloat(serviceRows[0].deposit_amount || 0);
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
    const reservationId = crypto.randomUUID();

    await conn.query(
      `INSERT INTO reservations (id, client_id, therapist_id, service_id, workshop_id, scheduled_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reservationId, clientId, therapist_id || null, service_id || null, workshop_id || null, scheduled_at, reservationNotes || null]
    );

    // Obtener la fila insertada
    const [insertedRows] = await conn.query(
      `SELECT id, client_id, therapist_id, service_id, workshop_id,
              scheduled_at, status, notes, created_at, updated_at
       FROM reservations WHERE id = ?`,
      [reservationId]
    );

    const newReservation = insertedRows[0];

    // Si se especificó un método de pago, registrar en payments
    if (payment_method) {
      const isOffline = payment_method === 'cash' || payment_method === 'transfer';
      const paymentStatus = isOffline ? 'pending' : 'completed';
      const paidVal = isOffline ? 0 : totalAmount;

      await conn.query(
        `INSERT INTO payments 
         (reservation_id, payment_method, status, 
          total_amount, paid_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newReservation.id,
          payment_method,
          paymentStatus,
          totalAmount,  // Siempre guardar el precio completo
          paidVal
        ]
      );
    }

    await conn.query('COMMIT');

    const emailService = require('../services/email.service');
    // No await — no bloquear la respuesta
    emailService.sendNotification({ type: 'confirmation', data: newReservation.id })
      .catch(err => console.error('Email error:', err));

    return res.status(201).json({
      data: {
        reservation: newReservation,
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
    await conn.query('ROLLBACK');
    console.error('❌ Error en create reservations:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
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
      const [currentRes] = await pool.query(
        'SELECT scheduled_at FROM reservations WHERE id = ?',
        [id]
      );

      if (currentRes.length > 0) {
        const scheduledAt = currentRes[0].scheduled_at;
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
      const [resDataResult] = await pool.query(
        `SELECT r.id, r.notes,
                COALESCE(s.price, w.price, 0) AS price,
                COALESCE(s.deposit_amount, w.deposit_amount, 0) AS deposit_amount
         FROM reservations r
         LEFT JOIN services s ON s.id = r.service_id
         LEFT JOIN workshops w ON w.id = r.workshop_id
         WHERE r.id = ? AND r.deleted_at IS NULL`,
        [id]
      );

      if (resDataResult.length > 0) {
        const totalAmount = resDataResult[0].price;
        const depositAmount = resDataResult[0].deposit_amount;
        const amountToPay = payment_type === 'deposit' && depositAmount > 0
          ? depositAmount
          : totalAmount;

        const isOffline = payment_method === 'cash' || payment_method === 'transfer';
        const paymentStatus = isOffline ? 'pending' : 'completed';
        const paidVal = isOffline ? 0 : amountToPay;

        // Actualizar notas de la reserva
        const currentNotes = resDataResult[0].notes || '';
        const payNotes = `Método de pago seleccionado: ${payment_method === 'cash' ? 'Efectivo' : payment_method === 'transfer' ? 'Transferencia' : payment_method}. Tipo: ${payment_type === 'deposit' ? 'Anticipo' : 'Pago Completo'}.`;
        const updatedNotes = currentNotes ? `${currentNotes} | ${payNotes}` : payNotes;

        // Si no se enviaron notas explícitas, usar las automáticas
        if (notes === undefined) {
          notes = updatedNotes;
        }

        // Crear o actualizar en payments
        const [paymentCheck] = await pool.query(
          'SELECT id FROM payments WHERE reservation_id = ? AND deleted_at IS NULL',
          [id]
        );

        if (paymentCheck.length > 0) {
          await pool.query(
            `UPDATE payments 
             SET payment_method = ?, status = ?, total_amount = ?, paid_amount = ?, updated_at = NOW()
             WHERE reservation_id = ?`,
            [payment_method, paymentStatus, totalAmount, paidVal, id]
          );
        } else {
          await pool.query(
            `INSERT INTO payments (reservation_id, payment_method, status, total_amount, paid_amount)
             VALUES (?, ?, ?, ?, ?)`,
            [id, payment_method, paymentStatus, totalAmount, paidVal]
          );
        }
      }
    }

    const setClauses = ['status = ?', 'updated_at = NOW()'];
    const values = [status];

    if (cancellation_reason !== undefined) {
      setClauses.push(`cancellation_reason = ?`);
      values.push(cancellation_reason);
    }

    if (notes !== undefined) {
      setClauses.push(`notes = ?`);
      values.push(notes);
    }

    values.push(id);

    const [result] = await pool.query(
      `UPDATE reservations
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    // Obtener la fila actualizada
    const [updatedRows] = await pool.query(
      `SELECT id, client_id, therapist_id, service_id, workshop_id,
              scheduled_at, status, cancellation_reason, notes, created_at, updated_at
       FROM reservations WHERE id = ?`,
      [id]
    );

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
      data: { reservation: updatedRows[0] },
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

    const [result] = await pool.query(
      `UPDATE reservations
       SET notes = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [notes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, client_id, therapist_id, service_id, workshop_id,
              scheduled_at, status, notes, created_at, updated_at
       FROM reservations WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { reservation: rows[0] },
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

    const [result] = await pool.query(
      `UPDATE reservations
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    return res.status(200).json({
      data: { id },
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

// -----------------------------------------------------------
// Helper: convierte un objeto Date a formato DATETIME de MySQL
// 'YYYY-MM-DD HH:MM:SS', siempre en UTC (igual que hacía Postgres
// con timestamptz). Colócalo arriba del archivo, junto al require.
// -----------------------------------------------------------
const toMySQLDatetime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

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
    const [current] = await pool.query(
      `SELECT id, status FROM reservations WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (current.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    // Validar que no esté cancelada ni completada
    const { status } = current[0];
    if (status === 'cancelled' || status === 'completed') {
      return res.status(400).json({
        error: `No se puede reprogramar una reserva con status "${status}"`,
      });
    }

    // Actualizar scheduled_at
    await pool.query(
      `UPDATE reservations
       SET scheduled_at = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [toMySQLDatetime(parsedDate), id]
    );

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, client_id, therapist_id, service_id, workshop_id,
              scheduled_at, status, notes, created_at, updated_at
       FROM reservations WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { reservation: rows[0] },
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
