// ============================================================
// products.controller.js — CRUD de productos
// ============================================================
// Funciones: getAll, getById, create, update, updateStock, remove
// Maneja el catálogo de productos del ecommerce.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/products
// Lista productos con paginación, filtros y búsqueda.
// Query params: ?page=1&limit=20&category_id=uuid&search=term
// Público.
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;
    const { category_id, search } = req.query;

    // WHERE dinámico
    const conditions = ['p.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (category_id) {
      conditions.push(`p.category_id = $${paramIndex}`);
      values.push(category_id);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`
      );
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Registros paginados
    const dataResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.price::FLOAT AS price,
              p.stock::INTEGER AS stock, p.image_urls, p.is_active,
              p.allows_shipping, p.allows_pickup,
              p.category_id, c.name AS category_name,
              p.created_at, p.updated_at
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      data: {
        products: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Productos obtenidos exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// GET /api/v1/products/:id
// Retorna un producto por ID con su categoría.
// Público.
// -----------------------------------------------------------
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price::FLOAT AS price,
              p.stock::INTEGER AS stock, p.image_urls, p.is_active,
              p.allows_shipping, p.allows_pickup,
              p.category_id, c.name AS category_name,
              p.created_at, p.updated_at
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    return res.status(200).json({
      data: { product: result.rows[0] },
      message: 'Producto obtenido exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getById products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/products
// Crea un nuevo producto. Solo admin.
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const {
      name, description, price, stock, category_id,
      image_urls, allows_shipping, allows_pickup,
    } = req.body;

    // Validación de campos obligatorios
    if (!name || price == null || stock == null) {
      return res.status(400).json({
        error: 'Los campos name, price y stock son obligatorios',
      });
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, category_id,
                             image_urls, allows_shipping, allows_pickup)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, price::FLOAT AS price,
                 stock::INTEGER AS stock, image_urls, is_active,
                 allows_shipping, allows_pickup,
                 category_id, created_at, updated_at`,
      [
        name,
        description || null,
        price,
        stock,
        category_id || null,
        image_urls || null,
        allows_shipping !== undefined ? allows_shipping : true,
        allows_pickup !== undefined ? allows_pickup : true,
      ]
    );

    return res.status(201).json({
      data: { product: result.rows[0] },
      message: 'Producto creado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/products/:id
// Actualiza campos enviados en el body. Solo admin.
// Nota: stock NO está aquí — tiene su propio endpoint.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'name', 'description', 'price', 'category_id',
      'image_urls', 'is_active', 'allows_shipping', 'allows_pickup',
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: 'Debes enviar al menos un campo para actualizar',
      });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE products
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, name, description, price::FLOAT AS price,
                 stock::INTEGER AS stock, image_urls, is_active,
                 allows_shipping, allows_pickup,
                 category_id, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    return res.status(200).json({
      data: { product: result.rows[0] },
      message: 'Producto actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/products/:id/stock
// Actualiza el stock de un producto. Solo admin.
// body: { operation: 'add' | 'subtract' | 'set', quantity: N }
// -----------------------------------------------------------
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { operation, quantity } = req.body;

    // Validaciones
    if (!operation || !['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        error: "El campo operation debe ser 'add', 'subtract' o 'set'",
      });
    }

    if (quantity == null || quantity < 0) {
      return res.status(400).json({
        error: 'El campo quantity debe ser un número mayor o igual a 0',
      });
    }

    // Verificar que el producto existe
    const current = await pool.query(
      'SELECT id, stock FROM products WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    const currentStock = current.rows[0].stock;

    // Calcular nuevo stock según operación
    let newStock;
    if (operation === 'add') {
      newStock = currentStock + quantity;
    } else if (operation === 'subtract') {
      if (currentStock < quantity) {
        return res.status(400).json({
          error: `Stock insuficiente. Stock actual: ${currentStock}, intentando restar: ${quantity}`,
        });
      }
      newStock = currentStock - quantity;
    } else {
      // operation === 'set'
      newStock = quantity;
    }

    const result = await pool.query(
      `UPDATE products
       SET stock = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, name, stock::INTEGER AS stock`,
      [newStock, id]
    );

    return res.status(200).json({
      data: { product: result.rows[0] },
      message: 'Stock actualizado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en updateStock products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/products/:id
// Soft delete. Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE products
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Producto eliminado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete products:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, getById, create, update, updateStock, remove };
