const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/therapist-services/me
// Retorna los servicios del terapeuta autenticado.
// Solo therapist.
// -----------------------------------------------------------
const getMyServices = async (req, res) => {
  try {
    const therapist_id = req.user.id;

    const result = await pool.query(
      `SELECT service_id FROM therapist_services WHERE therapist_id = $1`,
      [therapist_id]
    );

    const service_ids = result.rows.map(row => row.service_id);

    return res.status(200).json({
      data: { service_ids },
      message: 'Servicios del terapeuta obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getMyServices therapist_services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/therapist-services
// Agrega un servicio al terapeuta.
// Solo therapist.
// -----------------------------------------------------------
const addService = async (req, res) => {
  try {
    const therapist_id = req.user.id;
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({
        error: 'El campo service_id es obligatorio',
      });
    }

    // Validar que el servicio existe y está activo
    const serviceCheck = await pool.query(
      `SELECT id FROM services WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [service_id]
    );

    if (serviceCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'El servicio no existe o no está activo',
      });
    }

    const result = await pool.query(
      `INSERT INTO therapist_services (therapist_id, service_id)
       VALUES ($1, $2)
       RETURNING id, therapist_id, service_id, created_at`,
      [therapist_id, service_id]
    );

    return res.status(201).json({
      data: result.rows[0],
      message: 'Servicio agregado exitosamente',
    });
  } catch (error) {
    if (error.code === '23505') { // Violación de unicidad
      return res.status(409).json({
        error: 'Ya tienes este servicio activado',
      });
    }
    console.error('❌ Error en addService therapist_services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/therapist-services/:service_id
// Elimina un servicio del terapeuta.
// Solo therapist.
// -----------------------------------------------------------
const removeService = async (req, res) => {
  try {
    const therapist_id = req.user.id;
    const { service_id } = req.params;

    const result = await pool.query(
      `DELETE FROM therapist_services 
       WHERE therapist_id = $1 AND service_id = $2
       RETURNING id`,
      [therapist_id, service_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'La relación con este servicio no existe',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Servicio eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en removeService therapist_services:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getMyServices, addService, removeService };
