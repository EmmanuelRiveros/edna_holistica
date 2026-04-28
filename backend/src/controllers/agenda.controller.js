// ============================================================
// agenda.controller.js — Vista agregada de calendario
// ============================================================
// Combina 3 fuentes en paralelo para una vista completa:
//   1. Reservas de servicios (con duración real del servicio)
//   2. Reservas de talleres (con horarios del taller)
//   3. Talleres publicados sin inscripciones (eventos vacíos)
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/agenda
// Retorna todos los eventos del calendario fusionados.
// Solo admin / therapist.
// -----------------------------------------------------------
const getCalendarEvents = async (req, res) => {
  try {
    const [serviceReservations, workshopReservations, emptyWorkshops] =
      await Promise.all([
        // ── FUENTE 1: Citas de servicios ──
        pool.query(
          `SELECT r.id, r.scheduled_at, r.status, r.notes,
                  r.client_id,
                  c.first_name  AS client_first_name,
                  c.last_name   AS client_last_name,
                  c.email       AS client_email,
                  r.therapist_id,
                  t.first_name  AS therapist_first_name,
                  t.last_name   AS therapist_last_name,
                  r.service_id,
                  s.name        AS service_name,
                  s.duration_minutes,
                  s.price::FLOAT AS service_price
           FROM reservations r
           JOIN users    c ON c.id = r.client_id
           JOIN services s ON s.id = r.service_id
           LEFT JOIN users t ON t.id = r.therapist_id
           WHERE r.service_id IS NOT NULL
             AND r.deleted_at IS NULL
           ORDER BY r.scheduled_at`
        ),

        // ── FUENTE 2: Reservas de talleres ──
        pool.query(
          `SELECT r.id, r.scheduled_at, r.status, r.notes,
                  r.client_id,
                  c.first_name  AS client_first_name,
                  c.last_name   AS client_last_name,
                  c.email       AS client_email,
                  r.therapist_id,
                  t.first_name  AS therapist_first_name,
                  t.last_name   AS therapist_last_name,
                  r.workshop_id,
                  w.name        AS workshop_name,
                  w.starts_at   AS workshop_starts_at,
                  w.ends_at     AS workshop_ends_at,
                  w.price::FLOAT AS workshop_price
           FROM reservations r
           JOIN users     c ON c.id = r.client_id
           JOIN workshops w ON w.id = r.workshop_id
           LEFT JOIN users t ON t.id = r.therapist_id
           WHERE r.workshop_id IS NOT NULL
             AND r.deleted_at IS NULL
           ORDER BY r.scheduled_at`
        ),

        // ── FUENTE 3: Talleres publicados sin inscripciones ──
        pool.query(
          `SELECT w.id, w.name, w.starts_at, w.ends_at,
                  w.max_capacity, w.price::FLOAT AS price,
                  w.status, w.type
           FROM workshops w
           LEFT JOIN reservations r
             ON r.workshop_id = w.id AND r.deleted_at IS NULL
           WHERE w.status = 'published'
             AND w.deleted_at IS NULL
             AND r.id IS NULL
           ORDER BY w.starts_at`
        ),
      ]);

    // ── Mapear FUENTE 1 ──
    const serviceEvents = serviceReservations.rows.map((r) => {
      const start = new Date(r.scheduled_at);
      const durationMs = (r.duration_minutes || 60) * 60_000;
      return {
        id: r.id,
        type: 'reservation',
        entity: 'service',
        title: `${r.client_first_name} ${r.client_last_name} — ${r.service_name}`,
        start: start.toISOString(),
        end: new Date(start.getTime() + durationMs).toISOString(),
        status: r.status,
        client_id: r.client_id,
        client_first_name: r.client_first_name,
        client_last_name: r.client_last_name,
        client_email: r.client_email,
        therapist_id: r.therapist_id,
        therapist_first_name: r.therapist_first_name,
        therapist_last_name: r.therapist_last_name,
        service_id: r.service_id,
        service_name: r.service_name,
        duration_minutes: r.duration_minutes,
        price: r.service_price,
        notes: r.notes,
      };
    });

    // ── Mapear FUENTE 2 ──
    const workshopReservationEvents = workshopReservations.rows.map((r) => {
      const start = new Date(r.scheduled_at);
      // Usa la duración del taller si se tienen ambas fechas, sino 120 min
      let end;
      if (r.workshop_starts_at && r.workshop_ends_at) {
        const workshopDurationMs =
          new Date(r.workshop_ends_at).getTime() -
          new Date(r.workshop_starts_at).getTime();
        end = new Date(start.getTime() + workshopDurationMs);
      } else {
        end = new Date(start.getTime() + 120 * 60_000);
      }

      return {
        id: r.id,
        type: 'reservation',
        entity: 'workshop_reservation',
        title: `${r.client_first_name} ${r.client_last_name} — ${r.workshop_name}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: r.status,
        client_id: r.client_id,
        client_first_name: r.client_first_name,
        client_last_name: r.client_last_name,
        client_email: r.client_email,
        therapist_id: r.therapist_id,
        therapist_first_name: r.therapist_first_name,
        therapist_last_name: r.therapist_last_name,
        workshop_id: r.workshop_id,
        workshop_name: r.workshop_name,
        price: r.workshop_price,
        notes: r.notes,
      };
    });

    // ── Mapear FUENTE 3 ──
    const emptyWorkshopEvents = emptyWorkshops.rows.map((w) => ({
      id: w.id,
      type: 'workshop_event',
      entity: 'workshop',
      title: `🗓 ${w.name}`,
      start: new Date(w.starts_at).toISOString(),
      end: new Date(w.ends_at).toISOString(),
      status: w.status,
      workshop_type: w.type,
      max_capacity: w.max_capacity,
      price: w.price,
      enrolled: 0,
    }));

    // ── Combinar y responder ──
    const events = [
      ...serviceEvents,
      ...workshopReservationEvents,
      ...emptyWorkshopEvents,
    ];

    return res.status(200).json({
      data: {
        events,
        summary: {
          total: events.length,
          services: serviceEvents.length,
          workshop_reservations: workshopReservationEvents.length,
          empty_workshops: emptyWorkshopEvents.length,
        },
      },
      message: 'Eventos del calendario obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getCalendarEvents agenda:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getCalendarEvents };
