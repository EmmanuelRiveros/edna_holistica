// ============================================================
// payment_settings.controller.js — Configuración de pagos
// ============================================================
// Funciones: get, upsert
// Maneja los datos bancarios para transferencias.
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/payment-settings
// Retorna la configuración de transferencia.
// Público para cualquier usuario autenticado.
// -----------------------------------------------------------
const get = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, bank_name, account_holder, account_number,
              clabe, additional_info, updated_at
       FROM payment_settings
       LIMIT 1`
    );

    return res.status(200).json({
      data: { settings: rows[0] || {} },
      message: 'Configuración de pago obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en get payment_settings:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/payment-settings
// Crea o actualiza la configuración. Solo admin.
// Usa lógica de check-then-insert/update (un solo registro).
// -----------------------------------------------------------
const upsert = async (req, res) => {
  try {
    const {
      bank_name, account_holder, account_number,
      clabe, additional_info,
    } = req.body;

    // Buscar si ya existe un registro
    const [existing] = await pool.query('SELECT id FROM payment_settings LIMIT 1');

    if (existing.length > 0) {
      // Actualizar el registro existente
      await pool.query(
        `UPDATE payment_settings
         SET bank_name = ?, account_holder = ?, account_number = ?,
             clabe = ?, additional_info = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          bank_name || null,
          account_holder || null,
          account_number || null,
          clabe || null,
          additional_info || null,
          existing[0].id,
        ]
      );

      const [updatedRows] = await pool.query(
        `SELECT id, bank_name, account_holder, account_number,
                clabe, additional_info, updated_at
         FROM payment_settings WHERE id = ?`,
        [existing[0].id]
      );

      return res.status(200).json({
        data: { settings: updatedRows[0] },
        message: 'Configuración de pago actualizada exitosamente',
      });
    } else {
      // Insertar nuevo registro
      const id = crypto.randomUUID();

      await pool.query(
        `INSERT INTO payment_settings
           (id, bank_name, account_holder, account_number, clabe, additional_info, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          bank_name || null,
          account_holder || null,
          account_number || null,
          clabe || null,
          additional_info || null,
        ]
      );

      const [insertedRows] = await pool.query(
        `SELECT id, bank_name, account_holder, account_number,
                clabe, additional_info, updated_at
         FROM payment_settings WHERE id = ?`,
        [id]
      );

      return res.status(200).json({
        data: { settings: insertedRows[0] },
        message: 'Configuración de pago guardada exitosamente',
      });
    }
  } catch (error) {
    console.error('❌ Error en upsert payment_settings:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { get, upsert };
