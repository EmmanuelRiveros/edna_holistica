// ============================================================
// payment_settings.controller.js — Configuración de pagos
// ============================================================
// Funciones: get, upsert
// Maneja los datos bancarios para transferencias.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/payment-settings
// Retorna la configuración de transferencia.
// Público para cualquier usuario autenticado.
// -----------------------------------------------------------
const get = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, bank_name, account_holder, account_number,
              clabe, additional_info, updated_at
       FROM payment_settings
       LIMIT 1`
    );

    return res.status(200).json({
      data: { settings: result.rows[0] || {} },
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
// Usa INSERT ... ON CONFLICT DO UPDATE (un solo registro).
// -----------------------------------------------------------
const upsert = async (req, res) => {
  try {
    const {
      bank_name, account_holder, account_number,
      clabe, additional_info,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO payment_settings
         (id, bank_name, account_holder, account_number, clabe, additional_info, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         account_holder = EXCLUDED.account_holder,
         account_number = EXCLUDED.account_number,
         clabe = EXCLUDED.clabe,
         additional_info = EXCLUDED.additional_info,
         updated_at = NOW()
       RETURNING id, bank_name, account_holder, account_number,
                 clabe, additional_info, updated_at`,
      [
        bank_name || null,
        account_holder || null,
        account_number || null,
        clabe || null,
        additional_info || null,
      ]
    );

    // Si ya existe un registro, actualizarlo directamente
    if (result.rows.length === 0) {
      // Fallback: buscar el existente y actualizar
      const existing = await pool.query('SELECT id FROM payment_settings LIMIT 1');
      if (existing.rows.length > 0) {
        const updateResult = await pool.query(
          `UPDATE payment_settings
           SET bank_name = $1, account_holder = $2, account_number = $3,
               clabe = $4, additional_info = $5, updated_at = NOW()
           WHERE id = $6
           RETURNING id, bank_name, account_holder, account_number,
                     clabe, additional_info, updated_at`,
          [
            bank_name || null,
            account_holder || null,
            account_number || null,
            clabe || null,
            additional_info || null,
            existing.rows[0].id,
          ]
        );
        return res.status(200).json({
          data: { settings: updateResult.rows[0] },
          message: 'Configuración de pago actualizada exitosamente',
        });
      }
    }

    return res.status(200).json({
      data: { settings: result.rows[0] },
      message: 'Configuración de pago guardada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en upsert payment_settings:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { get, upsert };
