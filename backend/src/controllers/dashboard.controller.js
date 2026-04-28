// ============================================================
// dashboard.controller.js — Métricas del negocio
// ============================================================
// Función: getMetrics (retorna las 8 métricas en paralelo)
// Solo accesible para admin.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/dashboard
// Ejecuta todas las queries en paralelo con Promise.all().
// -----------------------------------------------------------
const getMetrics = async (req, res) => {
  try {
    const [
      clientsResult,
      newClientsByMonthResult,
      reservationsByStatusResult,
      revenueResult,
      topServicesResult,
      topWorkshopsResult,
      workshopOccupancyResult,
      therapistLoadResult,
    ] = await Promise.all([

      // ─── MÉTRICA 1: Total de clientes registrados ───
      pool.query(
        `SELECT
           COUNT(*)::INTEGER AS total,
           COUNT(*) FILTER (WHERE is_active = TRUE)::INTEGER AS active
         FROM users
         WHERE role = 'client' AND deleted_at IS NULL`
      ),

      // ─── MÉTRICA 2: Clientes nuevos por mes (últimos 6 meses) ───
      pool.query(
        `SELECT
           DATE_TRUNC('month', created_at) AS month,
           COUNT(*)::INTEGER AS count
         FROM users
         WHERE role = 'client'
           AND deleted_at IS NULL
           AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month ASC`
      ),

      // ─── MÉTRICA 3: Reservas por estado ───
      pool.query(
        `SELECT status, COUNT(*)::INTEGER AS count
         FROM reservations
         WHERE deleted_at IS NULL
         GROUP BY status`
      ),

      // ─── MÉTRICA 4: Ingresos totales y pendientes ───
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount), 0)::FLOAT AS total_billed,
           COALESCE(SUM(paid_amount), 0)::FLOAT AS total_paid,
           COALESCE(SUM(pending_amount), 0)::FLOAT AS total_pending
         FROM payments
         WHERE deleted_at IS NULL`
      ),

      // ─── MÉTRICA 5: Servicios más solicitados (top 5) ───
      pool.query(
        `SELECT
           r.service_id,
           s.name,
           COUNT(*)::INTEGER AS reservations_count
         FROM reservations r
         JOIN services s ON s.id = r.service_id
         WHERE r.service_id IS NOT NULL AND r.deleted_at IS NULL
         GROUP BY r.service_id, s.name
         ORDER BY reservations_count DESC
         LIMIT 5`
      ),

      // ─── MÉTRICA 6: Talleres más solicitados (top 5) ───
      pool.query(
        `SELECT
           r.workshop_id,
           w.name,
           COUNT(*)::INTEGER AS reservations_count,
           w.max_capacity
         FROM reservations r
         JOIN workshops w ON w.id = r.workshop_id
         WHERE r.workshop_id IS NOT NULL AND r.deleted_at IS NULL
         GROUP BY r.workshop_id, w.name, w.max_capacity
         ORDER BY reservations_count DESC
         LIMIT 5`
      ),

      // ─── MÉTRICA 7: Tasa de ocupación de talleres ───
      pool.query(
        `SELECT
           w.id AS workshop_id,
           w.name,
           w.max_capacity,
           COUNT(r.id)::INTEGER AS active_reservations,
           ROUND((COUNT(r.id)::NUMERIC / w.max_capacity::NUMERIC) * 100, 1)::FLOAT AS occupancy_rate
         FROM workshops w
         LEFT JOIN reservations r
           ON r.workshop_id = w.id
           AND r.status != 'cancelled'
           AND r.deleted_at IS NULL
         WHERE w.status = 'published' AND w.deleted_at IS NULL
         GROUP BY w.id, w.name, w.max_capacity
         ORDER BY occupancy_rate DESC`
      ),

      // ─── MÉTRICA 8: Carga por terapeuta ───
      pool.query(
        `SELECT
           u.id AS therapist_id,
           u.first_name,
           u.last_name,
           COUNT(r.id) FILTER (WHERE r.status = 'completed')::INTEGER AS completed,
           COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::INTEGER AS confirmed,
           COUNT(r.id)::INTEGER AS total
         FROM users u
         LEFT JOIN reservations r
           ON r.therapist_id = u.id
           AND r.deleted_at IS NULL
         WHERE u.role = 'therapist' AND u.is_active = TRUE AND u.deleted_at IS NULL
         GROUP BY u.id, u.first_name, u.last_name
         ORDER BY total DESC`
      ),
    ]);

    // Transformar métrica 3: de array a objeto
    const reservationsByStatus = reservationsByStatusResult.rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, { pending: 0, confirmed: 0, cancelled: 0, completed: 0, no_show: 0 });

    return res.status(200).json({
      data: {
        metrics: {
          clients: clientsResult.rows[0],
          new_clients_by_month: newClientsByMonthResult.rows,
          reservations_by_status: reservationsByStatus,
          revenue: revenueResult.rows[0],
          top_services: topServicesResult.rows,
          top_workshops: topWorkshopsResult.rows,
          workshop_occupancy: workshopOccupancyResult.rows,
          therapist_load: therapistLoadResult.rows,
        },
      },
      message: 'Métricas obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getMetrics dashboard:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getMetrics };
