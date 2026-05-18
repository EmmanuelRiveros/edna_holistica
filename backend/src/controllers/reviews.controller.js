// ============================================================
// reviews.controller.js — Reseñas de Productos
// ============================================================
// Funciones: getByProduct, getAll, create, moderate, delete
// ============================================================

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
    const statsResult = await pool.query(
      `SELECT AVG(rating)::FLOAT AS average_rating,
              COUNT(*)::INTEGER AS total_reviews
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'`,
      [id]
    );

    const stats = statsResult.rows[0];

    // Obtener las reseñas paginadas
    const reviewsResult = await pool.query(
      `SELECT pr.id, pr.rating::INTEGER, pr.comment, pr.created_at,
              u.first_name, u.last_name
       FROM product_reviews pr
       LEFT JOIN users u ON u.id = pr.client_id
       WHERE pr.product_id = $1 AND pr.status = 'approved'
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    return res.status(200).json({
      data: {
        reviews: reviewsResult.rows,
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

    // Arrays independientes para cada consulta
    const reviewsParams = [parsedLimit, parsedOffset];
    const countParams = [];

    let reviewsWhereClause = '';
    let countWhereClause = '';

    // 2. Si hay status, armamos las cláusulas dinámicas para cada caso
    if (status) {
      // Para el conteo, el status será el primer parámetro ($1)
      countWhereClause = 'WHERE pr.status = $1';
      countParams.push(status);

      // Para las reseñas, el status será el tercer parámetro ($3)
      reviewsWhereClause = 'WHERE pr.status = $3';
      reviewsParams.push(status);
    }

    // 3. Ejecutamos el conteo con su propia configuración limpia
    const countQuery = `SELECT COUNT(*)::INTEGER FROM product_reviews pr ${countWhereClause}`;
    const totalResult = await pool.query(countQuery, countParams);
    const total = totalResult.rows[0].count;

    // 4. Ejecutamos la búsqueda principal de reseñas
    const reviewsQuery = `
      SELECT pr.id, pr.rating::INTEGER, pr.comment, pr.status, pr.created_at,
             u.first_name, u.last_name,
             p.name AS product_name
      FROM product_reviews pr
      LEFT JOIN users u ON u.id = pr.client_id
      LEFT JOIN products p ON p.id = pr.product_id
      ${reviewsWhereClause}
      ORDER BY pr.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const reviewsResult = await pool.query(reviewsQuery, reviewsParams);

    // 5. Retornamos la respuesta (usando las variables ya parseadas)
    return res.status(200).json({
      data: {
        reviews: reviewsResult.rows,
        total,
        page: parseInt(page, 10) || 1, // Por si page también viene vacío
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar que la orden existe, pertenece al cliente y está entregada
    const orderCheck = await client.query(
      `SELECT id FROM orders 
       WHERE id = $1 AND client_id = $2 AND status = 'delivered'`,
      [order_id, client_id]
    );

    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo puedes reseñar productos de órdenes entregadas' });
    }

    // 2. Verificar que el producto está en la orden
    const itemCheck = await client.query(
      `SELECT id FROM order_items 
       WHERE order_id = $1 AND product_id = $2`,
      [order_id, product_id]
    );

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este producto no está en la orden especificada' });
    }

    // 3. Insertar reseña (el error de duplicado se captura en el catch)
    const result = await client.query(
      `INSERT INTO product_reviews 
       (product_id, client_id, order_id, rating, comment, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, rating::INTEGER, comment, status, created_at`,
      [product_id, client_id, order_id, rating, comment || null]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      data: { review: result.rows[0] },
      message: 'Reseña enviada exitosamente. Pendiente de moderación.',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    // Capturar error 23505: Unique violation de PostgreSQL
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya dejaste una reseña para este producto en esta orden' });
    }

    console.error('❌ Error en create review:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
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
    const result = await pool.query(
      `UPDATE product_reviews
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }

    return res.status(200).json({
      data: { review: result.rows[0] },
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
    const result = await pool.query(
      `DELETE FROM product_reviews
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
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
