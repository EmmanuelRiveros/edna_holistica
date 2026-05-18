// ============================================================
// orders.controller.js — CRUD de órdenes
// ============================================================
// Funciones: getAll, getById, create, updateStatus, getMyOrders
// Maneja las órdenes del ecommerce con transacciones,
// validación de stock y soporte de cupones.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/orders
// Lista todas las órdenes con paginación y filtros.
// Solo admin.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { status, client_id } = req.query;

    // WHERE dinámico
    const conditions = ['o.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (client_id) {
      conditions.push(`o.client_id = $${paramIndex}`);
      values.push(client_id);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders o WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros paginados
    const dataResult = await pool.query(
      `SELECT o.id, o.client_id, o.status, o.delivery_type,
              o.total_amount::FLOAT AS total_amount,
              o.notes,
              o.created_at, o.updated_at,
              u.first_name AS client_first_name,
              u.last_name AS client_last_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.client_id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        orders: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Órdenes obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll orders:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/orders/:id
// Retorna una orden con sus items.
// Admin o el cliente dueño.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [orderResult, itemsResult] = await Promise.all([
      pool.query(
        `SELECT o.id, o.client_id, o.status, o.delivery_type,
                o.total_amount::FLOAT AS total_amount,
                o.recipient_name, o.street, o.neighborhood, o.postal_code,
                o.city, o.state, o.references, o.contact_phone, o.notes,
                o.created_at, o.updated_at,
                u.first_name AS client_first_name,
                u.last_name AS client_last_name,
                u.email AS client_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.client_id
         WHERE o.id = $1 AND o.deleted_at IS NULL`,
        [id]
      ),
      pool.query(
        `SELECT oi.id, oi.product_id, oi.quantity,
                oi.unit_price::FLOAT AS unit_price,
                oi.subtotal::FLOAT AS subtotal,
                oi.created_at,
                p.name AS product_name,
                p.image_urls AS product_image_urls
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.created_at ASC`,
        [id]
      ),
    ]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
      });
    }

    const order = orderResult.rows[0];

    // Verificar permisos: admin o cliente dueño
    if (req.user.role !== 'admin' && req.user.id !== order.client_id) {
      return res.status(403).json({
        error: 'No tienes permisos para ver esta orden',
      });
    }

    return res.status(200).json({
      data: {
        order,
        items: itemsResult.rows,
      },
      message: 'Orden obtenida exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById orders:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/orders
// Crea una nueva orden con transacción SQL.
// Accesible para client y admin.
// -----------------------------------------------------------
const create = async (req, res) => {
  const {
    items, delivery_type, coupon_code, notes,
    recipient_name, street, neighborhood, 
    postal_code, city, state, references, 
    contact_phone
  } = req.body;

  // Validaciones básicas
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Debes enviar al menos un producto en items',
    });
  }

  if (!delivery_type || !['shipping', 'pickup'].includes(delivery_type)) {
    return res.status(400).json({
      error: "El campo delivery_type debe ser 'shipping' o 'pickup'",
    });
  }

  if (delivery_type === 'shipping' && (!recipient_name || !street || !city || !state)) {
    return res.status(400).json({
      error: 'Faltan campos obligatorios de dirección para el envío',
    });
  }

  const clientId = req.user.role === 'admin'
    ? (req.body.client_id || req.user.id)
    : req.user.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar cada producto y calcular subtotales
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cada item debe tener product_id y quantity >= 1',
        });
      }

      const productResult = await client.query(
        `SELECT id, name, price::FLOAT AS price, stock, is_active
         FROM products
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: `Producto ${item.product_id} no encontrado`,
        });
      }

      const product = productResult.rows[0];

      if (!product.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `El producto "${product.name}" no está disponible`,
        });
      }

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`,
        });
      }

      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;

      validatedItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
      });
    }

    // 2. Procesar cupón si viene
    let discount = 0;
    let couponId = null;

    if (coupon_code) {
      const couponResult = await client.query(
        `SELECT id, discount_type, discount_value, min_purchase,
                max_uses, used_count, expires_at
         FROM coupons
         WHERE code = UPPER($1) AND is_active = TRUE`,
        [coupon_code]
      );

      if (couponResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cupón no válido o inactivo',
        });
      }

      const coupon = couponResult.rows[0];

      // Verificar expiración
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Este cupón ha expirado',
        });
      }

      // Verificar usos máximos
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Este cupón ha alcanzado el límite de usos',
        });
      }

      // Verificar compra mínima
      if (coupon.min_purchase !== null && subtotal < parseFloat(coupon.min_purchase)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `La compra mínima para este cupón es $${coupon.min_purchase}`,
        });
      }

      // Calcular descuento
      if (coupon.discount_type === 'percentage') {
        discount = subtotal * (coupon.discount_value / 100);
      } else {
        // fixed
        discount = Math.min(coupon.discount_value, subtotal);
      }

      couponId = coupon.id;
    }

    // 3. Calcular total final
    const totalAmount = Math.max(subtotal - discount, 0);

    // 4. Insertar la orden
    const orderResult = await client.query(
      `INSERT INTO orders (client_id, status, delivery_type, total_amount,
                           recipient_name, street, neighborhood, postal_code,
                           city, state, "references", contact_phone, notes)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, client_id, status, delivery_type,
                 total_amount::FLOAT AS total_amount,
                 recipient_name, street, neighborhood, postal_code,
                 city, state, "references", contact_phone, notes, created_at, updated_at`,
      [
        clientId, delivery_type, totalAmount, 
        recipient_name || null, street || null, neighborhood || null, postal_code || null,
        city || null, state || null, references || null, contact_phone || null, notes || null
      ]
    );

    const newOrder = orderResult.rows[0];

    // 5. Insertar order_items y descontar stock
    for (const vi of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [newOrder.id, vi.product_id, vi.quantity, vi.unit_price]
      );

      // 6. Descontar stock
      await client.query(
        `UPDATE products SET stock = stock - $1, updated_at = NOW()
         WHERE id = $2`,
        [vi.quantity, vi.product_id]
      );
    }

    // 7. Incrementar used_count del cupón si se usó
    if (couponId) {
      await client.query(
        `UPDATE coupons SET used_count = used_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [couponId]
      );
    }

    await client.query('COMMIT');

    // Obtener los items insertados
    const insertedItems = await pool.query(
      `SELECT oi.id, oi.product_id, oi.quantity,
              oi.unit_price::FLOAT AS unit_price,
              oi.subtotal::FLOAT AS subtotal,
              p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [newOrder.id]
    );

    return res.status(201).json({
      data: {
        order: newOrder,
        items: insertedItems.rows,
        discount_applied: discount > 0 ? discount : undefined,
      },
      message: 'Orden creada exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en create orders:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/orders/:id/status
// Actualiza el status de una orden. Solo admin.
// Si se cancela, restaura stock de cada item.
// -----------------------------------------------------------
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['confirmed', 'shipped', 'delivered', 'cancelled'];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: `El status debe ser uno de: ${allowedStatuses.join(', ')}`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que la orden existe
    const orderResult = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Orden no encontrada',
      });
    }

    const currentStatus = orderResult.rows[0].status;

    // No permitir cambiar una orden ya cancelada o entregada
    if (currentStatus === 'cancelled' || currentStatus === 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede cambiar el status de una orden "${currentStatus}"`,
      });
    }

    // Si se cancela, restaurar stock de cada item
    if (status === 'cancelled') {
      const itemsResult = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [id]
      );

      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE products SET stock = stock + $1, updated_at = NOW()
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    // Actualizar status
    const result = await client.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, client_id, status, delivery_type,
                 total_amount::FLOAT AS total_amount,
                 recipient_name, street, neighborhood, postal_code,
                 city, state, "references", contact_phone, notes, created_at, updated_at`,
      [status, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: { order: result.rows[0] },
      message: 'Status de orden actualizado exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en updateStatus orders:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// GET /api/v1/orders/my-orders
// Retorna las órdenes del cliente autenticado.
// Solo client.
// -----------------------------------------------------------
const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    // Total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders
       WHERE client_id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros paginados
    const dataResult = await pool.query(
      `SELECT id, client_id, status, delivery_type,
              total_amount::FLOAT AS total_amount,
              recipient_name, street, neighborhood, postal_code,
              city, state, "references", contact_phone, notes,
              created_at, updated_at
       FROM orders
       WHERE client_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    return res.status(200).json({
      data: {
        orders: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Mis órdenes obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getMyOrders:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, updateStatus, getMyOrders };
