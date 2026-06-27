// ============================================================
// availability.controller.js — Módulo de disponibilidad
// ============================================================
// Funciones: getMyAvailability, updateMyAvailability,
//            getTherapistAvailability, getAvailableSlots
// Gestiona horarios de terapeutas y cálculo de slots libres.
// ============================================================

const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// -----------------------------------------------------------
// Helper: Obtiene disponibilidad y settings por therapist_id
// Reutilizado por getMyAvailability y getTherapistAvailability
// -----------------------------------------------------------
const fetchAvailability = async (therapistId) => {
  const [availabilityRows, settingsRows] = await Promise.all([
    pool.query(
      `SELECT id, therapist_id, day_of_week, start_time, end_time,
              is_active, created_at, updated_at
       FROM therapist_availability
       WHERE therapist_id = ?
       ORDER BY day_of_week ASC`,
      [therapistId]
    ),
    pool.query(
      `SELECT cancellation_window_hours, refund_percentage_before_window,
              refund_percentage_after_window
       FROM therapist_settings
       WHERE therapist_id = ?`,
      [therapistId]
    ),
  ]);

  // mysql2 devuelve [rows, fields]
  const availability = availabilityRows[0].map(r => ({ ...r, is_active: !!r.is_active }));
  const settingsResult = settingsRows[0];

  const settings = settingsResult.length > 0
    ? settingsResult[0]
    : {
      cancellation_window_hours: 24,
      refund_percentage_before_window: 100,
      refund_percentage_after_window: 0,
    };

  return {
    availability,
    settings,
  };
};

// -----------------------------------------------------------
// GET /api/v1/availability/me
// Retorna la disponibilidad del terapeuta autenticado.
// Solo therapist / admin.
// -----------------------------------------------------------
const getMyAvailability = async (req, res) => {
  try {
    const data = await fetchAvailability(req.user.id);

    return res.status(200).json({
      data,
      message: 'Disponibilidad obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getMyAvailability:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/availability/me
// Actualiza la disponibilidad semanal completa del terapeuta.
// Usa transacción SQL.
// -----------------------------------------------------------
const updateMyAvailability = async (req, res) => {
  const { availability, settings } = req.body;

  // Validar que vengan los datos mínimos
  if (!availability || !Array.isArray(availability)) {
    return res.status(400).json({
      error: 'El campo availability debe ser un array',
    });
  }

  // Validar cada día del array
  for (const day of availability) {
    if (day.day_of_week === undefined || day.day_of_week < 0 || day.day_of_week > 6) {
      return res.status(400).json({
        error: 'day_of_week debe ser un número entre 0 y 6',
      });
    }

    if (day.start_time && day.end_time && day.start_time >= day.end_time) {
      return res.status(400).json({
        error: `end_time debe ser mayor que start_time para el día ${day.day_of_week}`,
      });
    }
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // 1. Eliminar disponibilidad actual
    await conn.query(
      'DELETE FROM therapist_availability WHERE therapist_id = ?',
      [req.user.id]
    );

    // 2. Insertar los nuevos registros de disponibilidad
    for (const day of availability) {
      await conn.query(
        `INSERT INTO therapist_availability
           (id, therapist_id, day_of_week, start_time, end_time, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.id,
          day.day_of_week,
          day.start_time,
          day.end_time,
          day.is_active !== undefined ? day.is_active : true,
        ]
      );
    }

    // 3. Upsert de políticas de cancelación en therapist_settings
    if (settings) {
      const cancellationWindow = settings.cancellation_window_hours ?? 24;
      const refundBefore = settings.refund_percentage_before_window ?? 100;
      const refundAfter = settings.refund_percentage_after_window ?? 0;

      await conn.query(
        `INSERT INTO therapist_settings (
           therapist_id,
           cancellation_window_hours,
           refund_percentage_before_window,
           refund_percentage_after_window
         )
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cancellation_window_hours = VALUES(cancellation_window_hours),
           refund_percentage_before_window = VALUES(refund_percentage_before_window),
           refund_percentage_after_window = VALUES(refund_percentage_after_window),
           updated_at = NOW()`,
        [req.user.id, cancellationWindow, refundBefore, refundAfter]
      );
    }

    await conn.query('COMMIT');

    // Retornar la disponibilidad actualizada
    const data = await fetchAvailability(req.user.id);

    return res.status(200).json({
      data,
      message: 'Disponibilidad actualizada exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en updateMyAvailability:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// GET /api/v1/availability/:therapist_id
// Retorna la disponibilidad de un terapeuta específico.
// Accesible para admin, therapist y client.
// -----------------------------------------------------------
const getTherapistAvailability = async (req, res) => {
  try {
    const { therapist_id } = req.params;

    const data = await fetchAvailability(therapist_id);

    return res.status(200).json({
      data,
      message: 'Disponibilidad del terapeuta obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getTherapistAvailability:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/availability/slots
// Calcula los horarios disponibles reales para una fecha.
// Query params: therapist_id, date (YYYY-MM-DD), service_id
// -----------------------------------------------------------
const getAvailableSlots = async (req, res) => {
  try {
    const { therapist_id, date, service_id } = req.query;

    // Validar parámetros obligatorios
    if (!therapist_id || !date || !service_id) {
      return res.status(400).json({
        error: 'Los parámetros therapist_id, date y service_id son obligatorios',
      });
    }

    // Validar formato de fecha
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: 'El formato de fecha debe ser YYYY-MM-DD',
      });
    }

    // 1. Obtener day_of_week de la fecha (0 = Domingo, 6 = Sábado)
    const dayOfWeek = parsedDate.getDay();

    // 2. Buscar el horario del terapeuta para ese día
    const [availabilityRows] = await pool.query(
      `SELECT start_time, end_time
       FROM therapist_availability
       WHERE therapist_id = ?
         AND day_of_week = ?
         AND is_active = true`,
      [therapist_id, dayOfWeek]
    );

    // 3. Si no trabaja ese día, retornar slots vacíos
    if (availabilityRows.length === 0) {
      return res.status(200).json({
        data: { slots: [] },
        message: 'El terapeuta no tiene disponibilidad para este día',
      });
    }

    const { start_time, end_time } = availabilityRows[0];

    // 4. Obtener duración del servicio y su buffer_minutes
    const [serviceRows] = await pool.query(
      'SELECT duration_minutes, buffer_minutes FROM services WHERE id = ? AND deleted_at IS NULL',
      [service_id]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({
        error: 'Servicio no encontrado',
      });
    }

    const durationMinutes = serviceRows[0].duration_minutes;
    const bufferMinutes = serviceRows[0].buffer_minutes ?? 15;

    // 6. Generar todos los slots posibles
    const slots = [];
    const interval = durationMinutes + bufferMinutes;

    // Convertir start_time y end_time (HH:MM:SS) a minutos desde medianoche
    const startParts = start_time.split(':');
    const endParts = end_time.split(':');
    const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
    const endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);

    for (let current = startMinutes; current + durationMinutes <= endMinutes; current += interval) {
      const hours = Math.floor(current / 60).toString().padStart(2, '0');
      const mins = (current % 60).toString().padStart(2, '0');
      slots.push(`${hours}:${mins}`);
    }

    // 7. Obtener reservas existentes del terapeuta en esa fecha
    const [reservationRows] = await pool.query(
      `SELECT scheduled_at
       FROM reservations
       WHERE therapist_id = ?
         AND DATE(scheduled_at) = ?
         AND status NOT IN ('cancelled')
         AND deleted_at IS NULL`,
      [therapist_id, date]
    );

    // 8. Filtrar slots que choquen con reservas existentes
    const bookedTimes = reservationRows.map((row) => {
      const d = new Date(row.scheduled_at);
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));

    // 9. Retornar slots disponibles
    return res.status(200).json({
      data: { slots: availableSlots },
      message: 'Horarios disponibles obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAvailableSlots:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = {
  getMyAvailability,
  updateMyAvailability,
  getTherapistAvailability,
  getAvailableSlots,
};
