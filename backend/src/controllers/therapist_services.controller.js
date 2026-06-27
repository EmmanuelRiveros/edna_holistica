const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/therapist-services/me
// Retorna los servicios del terapeuta autenticado.
// Solo therapist.
// -----------------------------------------------------------
const getMyServices = async (req, res) => {
  try {
    const therapist_id = req.user.id;

    const [rows] = await pool.query(
      `SELECT service_id FROM therapist_services WHERE therapist_id = ?`,
      [therapist_id]
    );

    const service_ids = rows.map(row => row.service_id);

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
    const [serviceCheck] = await pool.query(
      `SELECT id FROM services WHERE id = ? AND is_active = true AND deleted_at IS NULL`,
      [service_id]
    );

    if (serviceCheck.length === 0) {
      return res.status(404).json({
        error: 'El servicio no existe o no está activo',
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO therapist_services (id, therapist_id, service_id)
       VALUES (?, ?, ?)`,
      [id, therapist_id, service_id]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, therapist_id, service_id, created_at
       FROM therapist_services WHERE id = ?`,
      [id]
    );

    return res.status(201).json({
      data: rows[0],
      message: 'Servicio agregado exitosamente',
    });
  } catch (error) {
    // Violación de unicidad en MySQL
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
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

    // Primero obtener el id del registro a eliminar (para devolverlo)
    const [existing] = await pool.query(
      `SELECT id FROM therapist_services 
       WHERE therapist_id = ? AND service_id = ?`,
      [therapist_id, service_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'La relación con este servicio no existe',
      });
    }

    const deletedId = existing[0].id;

    await pool.query(
      `DELETE FROM therapist_services 
       WHERE therapist_id = ? AND service_id = ?`,
      [therapist_id, service_id]
    );

    return res.status(200).json({
      data: { id: deletedId },
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
