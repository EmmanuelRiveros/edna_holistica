// ============================================================
// coupons.controller.js — CRUD de cupones de descuento
// ============================================================
// Funciones: getAll, create, update, validate, remove
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/coupons
// Lista todos los cupones. Solo admin.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, discount_type, discount_value,
              min_purchase,
              max_uses, used_count, expires_at, is_active,
              created_at, updated_at,
              CASE
                WHEN is_active = FALSE THEN 'inactive'
                WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
                WHEN max_uses IS NOT NULL AND used_count >= max_uses THEN 'exhausted'
                ELSE 'active'
              END AS status
       FROM coupons
       ORDER BY created_at DESC`
    );

    // Mapear booleanos
    const coupons = rows.map(r => ({ ...r, is_active: !!r.is_active }));

    return res.status(200).json({
      data: { coupons },
      message: 'Cupones obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll coupons:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/coupons
// Crea un cupón. Solo admin.
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const {
      code, discount_type, discount_value,
      min_purchase, max_uses, expires_at,
    } = req.body;

    // Validaciones
    if (!code || !discount_type || discount_value == null) {
      return res.status(400).json({
        error: 'Los campos code, discount_type y discount_value son obligatorios',
      });
    }

    if (!['percentage', 'fixed'].includes(discount_type)) {
      return res.status(400).json({
        error: "discount_type debe ser 'percentage' o 'fixed'",
      });
    }

    if (discount_type === 'percentage' && discount_value > 100) {
      return res.status(400).json({
        error: 'El porcentaje de descuento no puede ser mayor a 100',
      });
    }

    if (discount_value < 0) {
      return res.status(400).json({
        error: 'El valor de descuento no puede ser negativo',
      });
    }

    // Verificar que el código no exista
    const [existsCheck] = await pool.query(
      'SELECT id FROM coupons WHERE code = UPPER(?)',
      [code]
    );

    if (existsCheck.length > 0) {
      return res.status(400).json({
        error: 'Ya existe un cupón con este código',
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO coupons (id, code, discount_type, discount_value,
                            min_purchase, max_uses, expires_at)
       VALUES (?, UPPER(?), ?, ?, ?, ?, ?)`,
      [
        id,
        code,
        discount_type,
        discount_value,
        min_purchase || null,
        max_uses || null,
        expires_at || null,
      ]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, code, discount_type, discount_value,
              min_purchase,
              max_uses, used_count, expires_at, is_active,
              created_at, updated_at
       FROM coupons WHERE id = ?`,
      [id]
    );

    const coupon = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(201).json({
      data: { coupon },
      message: 'Cupón creado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create coupons:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/coupons/:id
// Actualiza un cupón. Solo admin.
// No permite cambiar code ni discount_type.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'discount_value', 'min_purchase', 'max_uses',
      'expires_at', 'is_active',
    ];

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

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE coupons
       SET ${setClauses.join(', ')}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cupón no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, code, discount_type, discount_value,
              min_purchase,
              max_uses, used_count, expires_at, is_active,
              created_at, updated_at
       FROM coupons WHERE id = ?`,
      [id]
    );

    const coupon = { ...rows[0], is_active: !!rows[0].is_active };

    return res.status(200).json({
      data: { coupon },
      message: 'Cupón actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update coupons:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/coupons/validate?code=CODIGO&total=monto
// Valida un cupón sin aplicarlo. Client y admin.
// -----------------------------------------------------------
const validate = async (req, res) => {
  try {
    const { code, total } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'El parámetro code es obligatorio',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, code, discount_type, discount_value,
              min_purchase,
              max_uses, used_count, expires_at, is_active
       FROM coupons
       WHERE code = UPPER(?)`,
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Cupón no encontrado',
      });
    }

    const coupon = { ...rows[0], is_active: !!rows[0].is_active };

    // Verificar activo
    if (!coupon.is_active) {
      return res.status(400).json({
        error: 'Este cupón está inactivo',
      });
    }

    // Verificar expiración
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Este cupón ha expirado',
      });
    }

    // Verificar usos
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({
        error: 'Este cupón ha alcanzado el límite de usos',
      });
    }

    // Calcular descuento si se proporcionó el total
    let discount = 0;
    const purchaseTotal = parseFloat(total) || 0;

    // Verificar compra mínima
    if (coupon.min_purchase !== null && purchaseTotal < coupon.min_purchase) {
      return res.status(400).json({
        error: `La compra mínima para este cupón es $${coupon.min_purchase}`,
      });
    }

    if (purchaseTotal > 0) {
      if (coupon.discount_type === 'percentage') {
        discount = purchaseTotal * (coupon.discount_value / 100);
      } else {
        discount = Math.min(coupon.discount_value, purchaseTotal);
      }
    }

    return res.status(200).json({
      data: {
        valid: true,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: parseFloat(discount.toFixed(2)),
        final_total: parseFloat(Math.max(purchaseTotal - discount, 0).toFixed(2)),
      },
      message: 'Cupón válido',
    });
  } catch (error) {
    console.error('❌ Error en validate coupons:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/coupons/:id
// Desactiva un cupón (is_active = FALSE). Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Primero verificar que existe
    const [existing] = await pool.query(
      `SELECT id, code FROM coupons WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Cupón no encontrado',
      });
    }

    await pool.query(
      `UPDATE coupons
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { id: existing[0].id, code: existing[0].code },
      message: 'Cupón desactivado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete coupons:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, create, update, validate, remove };
