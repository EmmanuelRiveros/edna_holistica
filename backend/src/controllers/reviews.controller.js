// ============================================================
// reviews.controller.js — Reseñas de Productos
// ============================================================
// Funciones: getByProduct, getAll, create, moderate, delete
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/products/:id/reviews
// Obtiene las reseñas aprobadas de un producto (Público)
// -----------------------------------------------------------
const getByProduct = async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Obtener promedio y conteo total
    const [statsRows] = await pool.query(
      `SELECT AVG(rating) AS average_rating,
              COUNT(*) AS total_reviews
       FROM product_reviews
       WHERE product_id = ? AND status = 'approved'`,
      [id]
    );

    const stats = statsRows[0];

    // Obtener las reseñas paginadas
    const [reviewsRows] = await pool.query(
      `SELECT pr.id, pr.rating, pr.comment, pr.created_at,
              u.first_name, u.last_name
       FROM product_reviews pr
       LEFT JOIN users u ON u.id = pr.client_id
       WHERE pr.product_id = ? AND pr.status = 'approved'
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({
      data: {
        reviews: reviewsRows,
        average_rating: stats.average_rating || 0,
        total_reviews: stats.total_reviews || 0,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      },
      message: 'Reseñas obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getByProduct reviews:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// -----------------------------------------------------------
// GET /api/v1/reviews
// Obtiene todas las reseñas para moderación (Solo Admin)
// -----------------------------------------------------------
const getAll = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  try {
    // 1. Aseguramos que limit y offset siempre sean números reales (fallback a 10 y 0)
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedOffset = parseInt(offset, 10) || 0;

    // 2. Construir WHERE dinámico
    let whereClause = '';
    const countParams = [];
    const reviewsParams = [];

    if (status) {
      whereClause = 'WHERE pr.status = ?';
      countParams.push(status);
      reviewsParams.push(status);
    }

    // 3. Ejecutamos el conteo
    const [totalResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM product_reviews pr ${whereClause}`,
      countParams
    );
    const total = totalResult[0].total;

    // 4. Ejecutamos la búsqueda principal de reseñas
    const [reviewsRows] = await pool.query(
      `SELECT pr.id, pr.rating, pr.comment, pr.status, pr.created_at,
             u.first_name, u.last_name,
             p.name AS product_name
      FROM product_reviews pr
      LEFT JOIN users u ON u.id = pr.client_id
      LEFT JOIN products p ON p.id = pr.product_id
      ${whereClause}
      ORDER BY pr.created_at DESC
      LIMIT ? OFFSET ?`,
      [...reviewsParams, parsedLimit, parsedOffset]
    );

    // 5. Retornamos la respuesta
    return res.status(200).json({
      data: {
        reviews: reviewsRows,
        total,
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
      message: 'Reseñas obtenidas exitosamente',
    });

  } catch (error) {
    console.error('❌ Error en getAll reviews:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// -----------------------------------------------------------
// POST /api/v1/reviews
// Crea una nueva reseña (Solo Client)
// -----------------------------------------------------------
const create = async (req, res) => {
  const { product_id, order_id, rating, comment } = req.body;
  const client_id = req.user.id;

  if (!product_id || !order_id || !rating) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (product_id, order_id, rating)' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'El rating debe estar entre 1 y 5' });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // 1. Verificar que la orden existe, pertenece al cliente y está entregada
    const [orderCheck] = await conn.query(
      `SELECT id FROM orders 
       WHERE id = ? AND client_id = ? AND status = 'delivered'`,
      [order_id, client_id]
    );

    if (orderCheck.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo puedes reseñar productos de órdenes entregadas' });
    }

    // 2. Verificar que el producto está en la orden
    const [itemCheck] = await conn.query(
      `SELECT id FROM order_items 
       WHERE order_id = ? AND product_id = ?`,
      [order_id, product_id]
    );

    if (itemCheck.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(400).json({ error: 'Este producto no está en la orden especificada' });
    }

    // 3. Insertar reseña (el error de duplicado se captura en el catch)
    const reviewId = crypto.randomUUID();

    await conn.query(
      `INSERT INTO product_reviews 
       (id, product_id, client_id, order_id, rating, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [reviewId, product_id, client_id, order_id, rating, comment || null]
    );

    await conn.query('COMMIT');

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, rating, comment, status, created_at
       FROM product_reviews WHERE id = ?`,
      [reviewId]
    );

    return res.status(201).json({
      data: { review: rows[0] },
      message: 'Reseña enviada exitosamente. Pendiente de moderación.',
    });
  } catch (error) {
    await conn.query('ROLLBACK');

    // Capturar error de clave duplicada en MySQL (código ER_DUP_ENTRY)
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(400).json({ error: 'Ya dejaste una reseña para este producto en esta orden' });
    }

    console.error('❌ Error en create review:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/reviews/:id/moderate
// Aprueba o rechaza una reseña (Solo Admin)
// -----------------------------------------------------------
const moderate = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'El status debe ser approved o rejected' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE product_reviews
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, status FROM product_reviews WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { review: rows[0] },
      message: `Reseña ${status === 'approved' ? 'aprobada' : 'rechazada'} exitosamente`,
    });
  } catch (error) {
    console.error('❌ Error en moderate review:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/reviews/:id
// Elimina una reseña (Solo Admin)
// -----------------------------------------------------------
const remove = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE FROM product_reviews
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }

    return res.status(200).json({
      data: { id },
      message: 'Reseña eliminada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en remove review:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getByProduct,
  getAll,
  create,
  moderate,
  remove,
};
