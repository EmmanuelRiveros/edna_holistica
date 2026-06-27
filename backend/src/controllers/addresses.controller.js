// ============================================================
// addresses.controller.js — CRUD de direcciones de envío
// ============================================================
// Funciones: getMyAddresses, create, update, setDefault, remove
// Maneja las direcciones de envío del cliente autenticado.
// ============================================================

const crypto = require('crypto');
const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/addresses
// Retorna todas las direcciones del cliente autenticado.
// -----------------------------------------------------------
const getMyAddresses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, client_id, alias, recipient_name, street,
              neighborhood, postal_code, city, state,
              \`references\`, contact_phone, is_default,
              created_at, updated_at
       FROM client_addresses
       WHERE client_id = ?
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    // Mapear booleanos
    const addresses = rows.map(r => ({ ...r, is_default: !!r.is_default }));

    return res.status(200).json({
      data: { addresses },
      message: 'Direcciones obtenidas exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en getMyAddresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/addresses
// Crea una nueva dirección. Si is_default=true o es la
// primera dirección, se establece como predeterminada.
// -----------------------------------------------------------
const create = async (req, res) => {
  const {
    alias, recipient_name, street, neighborhood,
    postal_code, city, state, references, contact_phone,
    is_default,
  } = req.body;

  // Validaciones
  if (!recipient_name || !street || !city || !state) {
    return res.status(400).json({
      error: 'Los campos recipient_name, street, city y state son obligatorios',
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar si es la primera dirección
    const [countResult] = await conn.query(
      'SELECT COUNT(*) AS total FROM client_addresses WHERE client_id = ?',
      [req.user.id]
    );
    const isFirst = countResult[0].total === 0;
    const shouldBeDefault = isFirst || is_default === true;

    // Si debe ser default, desmarcar las demás
    if (shouldBeDefault && !isFirst) {
      await conn.query(
        'UPDATE client_addresses SET is_default = FALSE WHERE client_id = ?',
        [req.user.id]
      );
    }

    const id = crypto.randomUUID();

    await conn.query(
      `INSERT INTO client_addresses
         (id, client_id, alias, recipient_name, street, neighborhood,
          postal_code, city, state, \`references\`, contact_phone, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        alias || null,
        recipient_name,
        street,
        neighborhood || null,
        postal_code || null,
        city,
        state,
        references || null,
        contact_phone || null,
        shouldBeDefault,
      ]
    );

    await conn.query('COMMIT');

    // Obtener la fila insertada
    const [rows] = await pool.query(
      `SELECT id, client_id, alias, recipient_name, street,
              neighborhood, postal_code, city, state,
              \`references\`, contact_phone, is_default,
              created_at, updated_at
       FROM client_addresses WHERE id = ?`,
      [id]
    );

    const address = { ...rows[0], is_default: !!rows[0].is_default };

    return res.status(201).json({
      data: { address },
      message: 'Dirección creada exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en create addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// PUT /api/v1/addresses/:id
// Actualiza una dirección. Verifica ownership.
// -----------------------------------------------------------
const update = async (req, res) => {
  const { id } = req.params;

  const allowedFields = [
    'alias', 'recipient_name', 'street', 'neighborhood',
    'postal_code', 'city', 'state', 'references', 'contact_phone',
  ];

  // Construir SET dinámico
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      // "references" es palabra reservada en MySQL
      const col = field === 'references' ? '`references`' : field;
      setClauses.push(`${col} = ?`);
      values.push(req.body[field]);
    }
  }

  const wantsDefault = req.body.is_default === true;

  if (setClauses.length === 0 && !wantsDefault) {
    return res.status(400).json({
      error: 'Debes enviar al menos un campo para actualizar',
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar ownership
    const [ownership] = await conn.query(
      'SELECT id, client_id FROM client_addresses WHERE id = ?',
      [id]
    );

    if (ownership.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    if (req.user.role !== 'admin' && ownership[0].client_id !== req.user.id) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para modificar esta dirección' });
    }

    // Si quiere marcar como default
    if (wantsDefault) {
      await conn.query(
        'UPDATE client_addresses SET is_default = FALSE WHERE client_id = ?',
        [ownership[0].client_id]
      );
      setClauses.push(`is_default = TRUE`);
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    await conn.query(
      `UPDATE client_addresses
       SET ${setClauses.join(', ')}
       WHERE id = ?`,
      values
    );

    await conn.query('COMMIT');

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, client_id, alias, recipient_name, street,
              neighborhood, postal_code, city, state,
              \`references\`, contact_phone, is_default,
              created_at, updated_at
       FROM client_addresses WHERE id = ?`,
      [id]
    );

    const address = { ...rows[0], is_default: !!rows[0].is_default };

    return res.status(200).json({
      data: { address },
      message: 'Dirección actualizada exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en update addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/addresses/:id/default
// Marca una dirección como predeterminada. Transacción.
// -----------------------------------------------------------
const setDefault = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar ownership
    const [ownership] = await conn.query(
      'SELECT id, client_id FROM client_addresses WHERE id = ?',
      [id]
    );

    if (ownership.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    const ownerId = ownership[0].client_id;

    if (req.user.role !== 'admin' && ownerId !== req.user.id) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para modificar esta dirección' });
    }

    // 1. Desmarcar todas
    await conn.query(
      'UPDATE client_addresses SET is_default = FALSE WHERE client_id = ?',
      [ownerId]
    );

    // 2. Marcar esta como default
    await conn.query(
      `UPDATE client_addresses
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.query('COMMIT');

    // Obtener la fila actualizada
    const [rows] = await pool.query(
      `SELECT id, client_id, alias, recipient_name, street,
              neighborhood, postal_code, city, state,
              \`references\`, contact_phone, is_default,
              created_at, updated_at
       FROM client_addresses WHERE id = ?`,
      [id]
    );

    const address = { ...rows[0], is_default: !!rows[0].is_default };

    return res.status(200).json({
      data: { address },
      message: 'Dirección predeterminada actualizada',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en setDefault addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/addresses/:id
// Hard delete. Si era default, promueve la más reciente.
// -----------------------------------------------------------
const remove = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.query('START TRANSACTION');

    // Verificar ownership
    const [ownership] = await conn.query(
      'SELECT id, client_id, is_default FROM client_addresses WHERE id = ?',
      [id]
    );

    if (ownership.length === 0) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    const address = ownership[0];

    if (req.user.role !== 'admin' && address.client_id !== req.user.id) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta dirección' });
    }

    // Eliminar
    await conn.query('DELETE FROM client_addresses WHERE id = ?', [id]);

    // Si era la default, promover la más reciente
    if (address.is_default) {
      const [candidates] = await conn.query(
        `SELECT id FROM client_addresses
         WHERE client_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [address.client_id]
      );

      if (candidates.length > 0) {
        await conn.query(
          `UPDATE client_addresses
           SET is_default = TRUE, updated_at = NOW()
           WHERE id = ?`,
          [candidates[0].id]
        );
      }
    }

    await conn.query('COMMIT');

    return res.status(200).json({
      data: { id },
      message: 'Dirección eliminada exitosamente',
    });
  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('❌ Error en delete addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
};

module.exports = { getMyAddresses, create, update, setDefault, remove };
