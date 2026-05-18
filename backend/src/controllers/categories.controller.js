// ============================================================
// categories.controller.js — CRUD de categorías de productos
// ============================================================
// Funciones: getAll, create, update, remove (soft)
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/categories
// Lista todas las categorías activas. Público.
// Sin paginación (son pocas).
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM product_categories
       WHERE deleted_at IS NULL
       ORDER BY name ASC`
    );

    return res.status(200).json({
      data: { categories: result.rows },
      message: 'Categorías obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getAll categories:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/categories
// Crea una nueva categoría. Solo admin.
// -----------------------------------------------------------
const create = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'El campo name es obligatorio',
      });
    }

    const result = await pool.query(
      `INSERT INTO product_categories (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at, updated_at`,
      [name, description || null]
    );

    return res.status(201).json({
      data: { category: result.rows[0] },
      message: 'Categoría creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en create categories:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// PUT /api/v1/categories/:id
// Actualiza nombre y/o descripción. Solo admin.
// -----------------------------------------------------------
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && description === undefined) {
      return res.status(400).json({
        error: 'Debes enviar al menos name o description para actualizar',
      });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE product_categories
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, name, description, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    return res.status(200).json({
      data: { category: result.rows[0] },
      message: 'Categoría actualizada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en update categories:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/categories/:id
// Soft delete. Solo admin.
// -----------------------------------------------------------
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE product_categories
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    return res.status(200).json({
      data: { id: result.rows[0].id },
      message: 'Categoría eliminada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en delete categories:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

module.exports = { getAll, create, update, remove };
