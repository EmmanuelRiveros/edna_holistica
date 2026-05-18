// ============================================================
// addresses.controller.js — CRUD de direcciones de envío
// ============================================================
// Funciones: getMyAddresses, create, update, setDefault, remove
// Maneja las direcciones de envío del cliente autenticado.
// ============================================================

const pool = require('../config/db');

// -----------------------------------------------------------
// GET /api/v1/addresses
// Retorna todas las direcciones del cliente autenticado.
// -----------------------------------------------------------
const getMyAddresses = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, client_id, alias, recipient_name, street,
              neighborhood, postal_code, city, state,
              "references", contact_phone, is_default,
              created_at, updated_at
       FROM client_addresses
       WHERE client_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      data: { addresses: result.rows },
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si es la primera dirección
    const countResult = await client.query(
      'SELECT COUNT(*)::INTEGER AS total FROM client_addresses WHERE client_id = $1',
      [req.user.id]
    );
    const isFirst = countResult.rows[0].total === 0;
    const shouldBeDefault = isFirst || is_default === true;

    // Si debe ser default, desmarcar las demás
    if (shouldBeDefault && !isFirst) {
      await client.query(
        'UPDATE client_addresses SET is_default = FALSE WHERE client_id = $1',
        [req.user.id]
      );
    }

    const result = await client.query(
      `INSERT INTO client_addresses
         (client_id, alias, recipient_name, street, neighborhood,
          postal_code, city, state, "references", contact_phone, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, client_id, alias, recipient_name, street,
                 neighborhood, postal_code, city, state,
                 "references", contact_phone, is_default,
                 created_at, updated_at`,
      [
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

    await client.query('COMMIT');

    return res.status(201).json({
      data: { address: result.rows[0] },
      message: 'Dirección creada exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en create addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
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
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      // "references" es palabra reservada en SQL
      const col = field === 'references' ? '"references"' : field;
      setClauses.push(`${col} = $${paramIndex}`);
      values.push(req.body[field]);
      paramIndex++;
    }
  }

  const wantsDefault = req.body.is_default === true;

  if (setClauses.length === 0 && !wantsDefault) {
    return res.status(400).json({
      error: 'Debes enviar al menos un campo para actualizar',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar ownership
    const ownership = await client.query(
      'SELECT id, client_id FROM client_addresses WHERE id = $1',
      [id]
    );

    if (ownership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    if (req.user.role !== 'admin' && ownership.rows[0].client_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para modificar esta dirección' });
    }

    // Si quiere marcar como default
    if (wantsDefault) {
      await client.query(
        'UPDATE client_addresses SET is_default = FALSE WHERE client_id = $1',
        [ownership.rows[0].client_id]
      );
      setClauses.push(`is_default = TRUE`);
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await client.query(
      `UPDATE client_addresses
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, client_id, alias, recipient_name, street,
                 neighborhood, postal_code, city, state,
                 "references", contact_phone, is_default,
                 created_at, updated_at`,
      values
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: { address: result.rows[0] },
      message: 'Dirección actualizada exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en update addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// PATCH /api/v1/addresses/:id/default
// Marca una dirección como predeterminada. Transacción.
// -----------------------------------------------------------
const setDefault = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar ownership
    const ownership = await client.query(
      'SELECT id, client_id FROM client_addresses WHERE id = $1',
      [id]
    );

    if (ownership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    const ownerId = ownership.rows[0].client_id;

    if (req.user.role !== 'admin' && ownerId !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para modificar esta dirección' });
    }

    // 1. Desmarcar todas
    await client.query(
      'UPDATE client_addresses SET is_default = FALSE WHERE client_id = $1',
      [ownerId]
    );

    // 2. Marcar esta como default
    const result = await client.query(
      `UPDATE client_addresses
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, client_id, alias, recipient_name, street,
                 neighborhood, postal_code, city, state,
                 "references", contact_phone, is_default,
                 created_at, updated_at`,
      [id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: { address: result.rows[0] },
      message: 'Dirección predeterminada actualizada',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en setDefault addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

// -----------------------------------------------------------
// DELETE /api/v1/addresses/:id
// Hard delete. Si era default, promueve la más reciente.
// -----------------------------------------------------------
const remove = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar ownership
    const ownership = await client.query(
      'SELECT id, client_id, is_default FROM client_addresses WHERE id = $1',
      [id]
    );

    if (ownership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    const address = ownership.rows[0];

    if (req.user.role !== 'admin' && address.client_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta dirección' });
    }

    // Eliminar
    await client.query('DELETE FROM client_addresses WHERE id = $1', [id]);

    // Si era la default, promover la más reciente
    if (address.is_default) {
      await client.query(
        `UPDATE client_addresses
         SET is_default = TRUE, updated_at = NOW()
         WHERE id = (
           SELECT id FROM client_addresses
           WHERE client_id = $1
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [address.client_id]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      data: { id },
      message: 'Dirección eliminada exitosamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en delete addresses:', error.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  } finally {
    client.release();
  }
};

module.exports = { getMyAddresses, create, update, setDefault, remove };
