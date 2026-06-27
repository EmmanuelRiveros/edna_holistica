// ============================================================
// categories.controller.js — CRUD de categorías de productos
// ============================================================
// Funciones: getAll, create, update, remove (soft)
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/categories
// Lista todas las categorías activas. Público.
// Sin paginación (son pocas).
// -----------------------------------------------------------
const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM product_categories
       WHERE deleted_at IS NULL
       ORDER BY name ASC`
    );

    return res.status(200).json({
      data: { categories: rows },
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

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO product_categories (id, name, description)
       VALUES (?, ?, ?)`,
      [id, name, description || null]
    );

    // Obtener la fila recién insertada (para created_at generado por la DB)
    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM product_categories WHERE id = ?`,
      [id]
    );

    return res.status(201).json({
      data: { category: rows[0] },
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

    if (name !== undefined) {
      setClauses.push(`name = ?`);
      values.push(name);
    }

    if (description !== undefined) {
      setClauses.push(`description = ?`);
      values.push(description);
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE product_categories
       SET ${setClauses.join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM product_categories WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      data: { category: rows[0] },
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

    const [result] = await pool.query(
      `UPDATE product_categories
       SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    return res.status(200).json({
      data: { id },
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
