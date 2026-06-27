// ============================================================
// products.controller.js — CRUD de productos
// ============================================================
// Funciones: getAll, getById, create, update, updateStock, remove
// Maneja el catálogo de productos del ecommerce.
// ============================================================

const crypto = require('crypto');
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

    if (category_id) {
      conditions.push(`p.category_id = ?`);
      values.push(category_id);
    }

    if (search) {
      conditions.push(
        `(p.name LIKE ? OR p.description LIKE ?)`
      );
      values.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    // Registros paginados
    const [dataRows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price,
              p.stock, p.image_urls, p.is_active,
              p.allows_shipping, p.allows_pickup,
              p.category_id, c.name AS category_name,
              p.created_at, p.updated_at
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    // Mapear booleanos
    const products = dataRows.map(r => ({
      ...r,
      is_active: !!r.is_active,
      allows_shipping: !!r.allows_shipping,
      allows_pickup: !!r.allows_pickup,
    }));

    return res.status(200).json({
      data: {
        products,
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

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price,
              p.stock, p.image_urls, p.is_active,
              p.allows_shipping, p.allows_pickup,
              p.category_id, c.name AS category_name,
              p.created_at, p.updated_at
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    const product = {
      ...rows[0],
      is_active: !!rows[0].is_active,
      allows_shipping: !!rows[0].allows_shipping,
      allows_pickup: !!rows[0].allows_pickup,
    };

    return res.status(200).json({
      data: { product },
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

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO products (id, name, description, price, stock, category_id,
                             image_urls, allows_shipping, allows_pickup)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        description || null,
        price,
        stock,
        category_id || null,
        image_urls ? JSON.stringify(image_urls) : null,
        allows_shipping !== undefined ? allows_shipping : true,
        allows_pickup !== undefined ? allows_pickup : true,
      ]
    );

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, name, description, price,
              stock, image_urls, is_active,
              allows_shipping, allows_pickup,
              category_id, created_at, updated_at
       FROM products WHERE id = ?`,
      [id]
    );

    const product = {
      ...rows[0],
      is_active: !!rows[0].is_active,
      allows_shipping: !!rows[0].allows_shipping,
      allows_pickup: !!rows[0].allows_pickup,
    };

    return res.status(201).json({
      data: { product },
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

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        if (field === 'image_urls') {
          values.push(JSON.stringify(req.body[field]));
        } else {
          values.push(req.body[field]);
        }
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
      `UPDATE products
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, name, description, price,
              stock, image_urls, is_active,
              allows_shipping, allows_pickup,
              category_id, created_at, updated_at
       FROM products WHERE id = ?`,
      [id]
    );

    const product = {
      ...rows[0],
      is_active: !!rows[0].is_active,
      allows_shipping: !!rows[0].allows_shipping,
      allows_pickup: !!rows[0].allows_pickup,
    };

    return res.status(200).json({
      data: { product },
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
    const [current] = await pool.query(
      'SELECT id, stock FROM products WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (current.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    const currentStock = current[0].stock;

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

    await pool.query(
      `UPDATE products
       SET stock = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [newStock, id]
    );

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, name, stock FROM products WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { product: rows[0] },
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

    const [result] = await pool.query(
      `UPDATE products
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    return res.status(200).json({
      data: { id },
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
