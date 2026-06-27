// ============================================================
// payments.controller.js — Gestión de pagos
// ============================================================
// Funciones: create, update, getByReservation
// pending_amount es columna generada (solo lectura).
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// Columnas de lectura para pagos (incluye pending_amount generado)
const PAYMENT_COLS = `id, reservation_id, payment_method, status,
                      total_amount,
                      paid_amount,
                      pending_amount,
                      receipt_url, external_reference,
                      created_at, updated_at`;

// -----------------------------------------------------------
// POST /api/v1/payments
// Crea un pago vinculado a una reserva. Solo admin.
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const { reservation_id, payment_method, total_amount, paid_amount, receipt_url, external_reference } = req.body;

    // Validar campos obligatorios
    if (!reservation_id || !payment_method || total_amount == null) {
      return res.status(400).json({
        error: 'Los campos reservation_id, payment_method y total_amount son obligatorios',
      });
    }

    // Validar total_amount > 0
    if (total_amount <= 0) {
      return res.status(400).json({
        error: 'El total_amount debe ser mayor a 0',
      });
    }

    // Validar paid_amount <= total_amount
    const paidValue = paid_amount || 0;
    if (paidValue > total_amount) {
      return res.status(400).json({
        error: 'El paid_amount no puede exceder el total_amount',
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO payments (id, reservation_id, payment_method, total_amount, paid_amount, receipt_url, external_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, reservation_id, payment_method, total_amount, paidValue, receipt_url || null, external_reference || null]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT ${PAYMENT_COLS} FROM payments WHERE id = ?`,
      [id]
    );

    return res.status(201).json({
      data: { payment: rows[0] },
      message: 'Pago creado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create payments:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/payments/:id
// Actualiza un pago. Solo admin. Construye SET dinámicamente.
// Valida que paid_amount no exceda total_amount.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = ['paid_amount', 'status', 'receipt_url', 'external_reference'];

    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'Debes enviar al menos un campo para actualizar',
      });
    }

    // Si se actualiza paid_amount, validar contra total_amount
    if (req.body.paid_amount !== undefined) {
      const [current] = await pool.query(
        'SELECT total_amount FROM payments WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (current.length === 0) {
        return res.status(404).json({
          error: 'Pago no encontrado',
        });
      }

      const totalAmount = parseFloat(current[0].total_amount);

      if (req.body.paid_amount > totalAmount) {
        return res.status(400).json({
          error: 'El paid_amount no puede exceder el total_amount',
        });
      }
    }

    // Siempre actualizar updated_at
    setClauses.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE payments
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Pago no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT ${PAYMENT_COLS} FROM payments WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { payment: rows[0] },
      message: 'Pago actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update payments:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/reservations/:id/payments
// Retorna todos los pagos de una reserva.
// Admin, therapist, o el cliente dueño de la reserva.
// -----------------------------------------------------------
const getByReservation = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la reserva existe y obtener el client_id
    const [reservation] = await pool.query(
      'SELECT client_id FROM reservations WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (reservation.length === 0) {
      return res.status(404).json({
        error: 'Reserva no encontrada',
      });
    }

    // Verificar permisos
    const reservationData = reservation[0];
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'therapist' &&
      req.user.id !== reservationData.client_id
    ) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    // Obtener pagos
    const [rows] = await pool.query(
      `SELECT ${PAYMENT_COLS}
       FROM payments
       WHERE reservation_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [id]
    );

    return res.status(200).json({
      data: { payments: rows },
      message: 'Pagos obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getByReservation payments:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/payments
// Lista todos los pagos con paginación y filtro por estado.
// Solo admin.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { status, search, startDate, endDate } = req.query;

    const conditions = ['p.deleted_at IS NULL'];
    const values = [];

    if (status) {
      conditions.push(`p.status = ?`);
      values.push(status);
    }

    if (search) {
      conditions.push(`(CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR s.name LIKE ? OR w.name LIKE ?)`);
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (startDate) {
      conditions.push(`p.created_at >= ?`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`p.created_at <= DATE_ADD(?, INTERVAL 1 DAY) - INTERVAL 1 SECOND`);
      values.push(endDate);
    }

    const whereClause = conditions.join(' AND ');
    
    const baseJoins = `
       FROM payments p
       LEFT JOIN reservations r ON r.id = p.reservation_id
       LEFT JOIN users u ON u.id = r.client_id
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
    `;

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total ${baseJoins} WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros
    const [rows] = await pool.query(
      `SELECT p.id, p.payment_method, p.status, 
              p.total_amount, p.paid_amount, p.pending_amount,
              p.receipt_url, p.external_reference, p.created_at,
              r.id AS reservation_id, r.scheduled_at,
              u.first_name AS client_first_name, u.last_name AS client_last_name, u.email AS client_email,
              s.name AS service_name,
              w.name AS workshop_name
       ${baseJoins}
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        payments: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Pagos obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll payments:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, create, update, getByReservation };
