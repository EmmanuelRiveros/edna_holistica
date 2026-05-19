// ============================================================
// checkout.controller.js — Pasarelas de pago
// ============================================================
// Integra MercadoPago y PayPal para procesar pagos de
// órdenes de productos y reservas de servicios.
// ============================================================

const pool = require('../config/db');

// ── MercadoPago SDK ─────────────────────────────────────────
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ── PayPal SDK ──────────────────────────────────────────────
const paypal = require('@paypal/checkout-server-sdk');

function getPayPalClient() {
  const environment =
    process.env.PAYPAL_MODE === 'sandbox'
      ? new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
      : new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );
  return new paypal.core.PayPalHttpClient(environment);
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Obtiene los datos de pago a partir de order_id o reservation_id.
 * Retorna { type, id, items, totalAmount } o lanza error.
 */
async function resolvePaymentData(order_id, reservation_id) {
  if (order_id) {
    const orderResult = await pool.query(
      `SELECT o.id, o.total_amount::FLOAT AS total_amount, o.status
       FROM orders o
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      throw { status: 404, message: 'Orden no encontrada' };
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT oi.quantity, oi.unit_price::FLOAT AS unit_price,
              p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order_id]
    );

    const items = itemsResult.rows.map((i) => ({
      title: i.product_name || 'Producto',
      quantity: i.quantity,
      unit_price: i.unit_price,
      currency_id: 'MXN',
    }));

    return {
      type: 'order',
      id: order.id,
      items,
      totalAmount: order.total_amount,
    };
  }

  if (reservation_id) {
    const resResult = await pool.query(
      `SELECT r.id, r.status,
              COALESCE(s.price, w.price, 0)::FLOAT AS price,
              COALESCE(s.name, w.name, 'Servicio') AS service_name
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [reservation_id]
    );

    if (resResult.rows.length === 0) {
      throw { status: 404, message: 'Reserva no encontrada' };
    }

    const reservation = resResult.rows[0];

    return {
      type: 'reservation',
      id: reservation.id,
      items: [
        {
          title: reservation.service_name,
          quantity: 1,
          unit_price: reservation.price,
          currency_id: 'MXN',
        },
      ],
      totalAmount: reservation.price,
    };
  }

  throw { status: 400, message: 'Debes enviar order_id o reservation_id' };
}

// =============================================================
// MERCADOPAGO
// =============================================================

// -----------------------------------------------------------
// POST /api/v1/checkout/mp/preference
// Crea una preferencia de pago en MercadoPago.
// -----------------------------------------------------------
const createMPPreference = async (req, res) => {
  try {
    if (!process.env.FRONTEND_URL || !process.env.BACKEND_URL) {
      return res.status(500).json({
        error: 'FRONTEND_URL o BACKEND_URL no configuradas en variables de entorno'
      });
    }

    const { order_id, reservation_id } = req.body;
    const data = await resolvePaymentData(order_id, reservation_id);

    const preference = new Preference(mpClient);

    console.log("--- ¡AUDITORÍA DE VARIABLES DE ENTORNO! ---");
    console.log("FRONTEND_URL actual:", process.env.FRONTEND_URL);
    console.log("order_id recibido:", req.body.order_id);
    console.log("-----------------------------------------");

    const result = await preference.create({
      body: {
        items: data.items,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/portal/pago/exitoso`,
          failure: `${process.env.FRONTEND_URL}/portal/pago/fallido`,
          pending: `${process.env.FRONTEND_URL}/portal/pago/pendiente`,
        },
        auto_return: 'approved',
        external_reference: data.id,
        notification_url: `${process.env.BACKEND_URL}/api/v1/checkout/mp/webhook`
      },
    });

    return res.status(200).json({
      data: {
        preference_id: result.id,
        init_point: result.init_point,
      },
      message: 'Preferencia de MercadoPago creada exitosamente',
    });
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Error en createMPPreference:', error.message || error);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/mp/webhook
// Recibe notificaciones de MercadoPago. Público.
// -----------------------------------------------------------
const mpWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;

    // Solo procesamos notificaciones de pago
    if (type === 'payment') {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      if (payment.status === 'approved') {
        const externalRef = payment.external_reference;

        if (!externalRef) {
          return res.status(200).send('OK');
        }

        // Intentar como order_id primero
        const orderCheck = await pool.query(
          'SELECT id FROM orders WHERE id = $1 AND deleted_at IS NULL',
          [externalRef]
        );

        if (orderCheck.rows.length > 0) {
          await pool.query(
            `UPDATE orders SET status = 'confirmed', updated_at = NOW()
             WHERE id = $1`,
            [externalRef]
          );
        } else {
          // Intentar como reservation_id
          const resCheck = await pool.query(
            'SELECT id, service_id, workshop_id FROM reservations WHERE id = $1 AND deleted_at IS NULL',
            [externalRef]
          );

          if (resCheck.rows.length > 0) {
            await pool.query(
              `UPDATE reservations SET status = 'confirmed', updated_at = NOW()
               WHERE id = $1`,
              [externalRef]
            );

            // Registrar el pago
            await pool.query(
              `INSERT INTO payments
                 (reservation_id, payment_method, status, total_amount,
                  paid_amount, external_reference)
               VALUES ($1, 'mercadopago', 'paid', $2, $2, $3)`,
              [
                externalRef,
                payment.transaction_amount,
                String(data.id),
              ]
            );
          }
        }
      }
    }

    // Siempre responder 200 para evitar reintentos
    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en mpWebhook:', error.message);
    // Aun con error, responder 200 para evitar reintentos infinitos
    return res.status(200).send('OK');
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/mp/reservation-preference
// -----------------------------------------------------------
const createReservationMPPreference = async (req, res) => {
  try {
    if (!process.env.FRONTEND_URL || !process.env.BACKEND_URL) {
      return res.status(500).json({
        error: 'FRONTEND_URL o BACKEND_URL no configuradas en variables de entorno'
      });
    }

    const { reservation_id, payment_type } = req.body;

    if (!reservation_id || !payment_type) {
      return res.status(400).json({ error: 'reservation_id y payment_type son obligatorios' });
    }

    const resResult = await pool.query(
      `SELECT r.*, 
        s.name AS service_name, s.price::FLOAT AS service_price,
        s.deposit_amount::FLOAT AS service_deposit,
        w.name AS workshop_name, w.price::FLOAT AS workshop_price,
        w.deposit_amount::FLOAT AS workshop_deposit
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [reservation_id]
    );

    if (resResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reservation = resResult.rows[0];
    let title = reservation.service_name || reservation.workshop_name || 'Reserva';
    let amount = 0;
    
    if (payment_type === 'full') {
      amount = (reservation.service_price || reservation.workshop_price || 0);
      title += ' (Pago completo)';
    } else if (payment_type === 'deposit') {
      amount = (reservation.service_deposit || reservation.workshop_deposit || 0);
      if (amount === 0) {
        return res.status(400).json({ error: 'Este servicio no tiene anticipo configurado' });
      }
      title += ' (Anticipo)';
    } else {
      return res.status(400).json({ error: 'payment_type inválido. Usa "deposit" o "full"' });
    }

    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            title: title,
            quantity: 1,
            unit_price: amount,
            currency_id: 'MXN',
          }
        ],
        back_urls: {
          success: `${process.env.FRONTEND_URL}/portal/reserva/pago/exitoso`,
          failure: `${process.env.FRONTEND_URL}/portal/reserva/pago/fallido`,
          pending: `${process.env.FRONTEND_URL}/portal/reserva/pago/pendiente`,
        },
        auto_return: 'approved',
        external_reference: reservation_id,
        notification_url: `${process.env.BACKEND_URL}/api/v1/checkout/mp/reservation-webhook`
      },
    });

    return res.status(200).json({
      data: {
        preference_id: result.id,
        init_point: result.init_point,
      },
      message: 'Preferencia de MercadoPago para reserva creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en createReservationMPPreference:', error.message || error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/mp/reservation-webhook
// -----------------------------------------------------------
const mpReservationWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === 'payment') {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      if (payment.status === 'approved') {
        const externalRef = payment.external_reference;

        if (!externalRef) {
          return res.status(200).send('OK');
        }

        const resCheck = await pool.query(
          `SELECT r.id, COALESCE(s.price, w.price, 0)::FLOAT AS total_price
           FROM reservations r
           LEFT JOIN services s ON s.id = r.service_id
           LEFT JOIN workshops w ON w.id = r.workshop_id
           WHERE r.id = $1 AND r.deleted_at IS NULL`,
          [externalRef]
        );

        if (resCheck.rows.length > 0) {
          const reservation = resCheck.rows[0];
          
          await pool.query(
            `UPDATE reservations SET status = 'confirmed', updated_at = NOW()
             WHERE id = $1`,
            [externalRef]
          );

          const payCheck = await pool.query(
            `SELECT id FROM payments WHERE reservation_id = $1 AND deleted_at IS NULL`,
            [externalRef]
          );

          if (payCheck.rows.length > 0) {
            await pool.query(
              `UPDATE payments 
               SET payment_method = 'mercadopago', status = 'completed', total_amount = $1, paid_amount = $2, external_reference = $3, updated_at = NOW()
               WHERE reservation_id = $4`,
              [
                reservation.total_price,
                payment.transaction_amount,
                String(data.id),
                externalRef
              ]
            );
          } else {
            await pool.query(
              `INSERT INTO payments
                 (reservation_id, payment_method, status, total_amount, paid_amount, external_reference)
               VALUES ($1, 'mercadopago', 'completed', $2, $3, $4)`,
              [
                externalRef,
                reservation.total_price,
                payment.transaction_amount,
                String(data.id),
              ]
            );
          }
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en mpReservationWebhook:', error.message);
    return res.status(200).send('OK');
  }
};

// =============================================================
// PAYPAL
// =============================================================

// -----------------------------------------------------------
// POST /api/v1/checkout/paypal/create-order
// Crea una orden de pago en PayPal.
// -----------------------------------------------------------
const createPayPalOrder = async (req, res) => {
  try {
    const { order_id, reservation_id } = req.body;
    const data = await resolvePaymentData(order_id, reservation_id);

    const client = getPayPalClient();
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: data.id,
          amount: {
            currency_code: 'MXN',
            value: data.totalAmount.toFixed(2),
          },
          description: data.items.map((i) => i.title).join(', '),
        },
      ],
    });

    const response = await client.execute(request);

    return res.status(200).json({
      data: {
        paypal_order_id: response.result.id,
      },
      message: 'Orden de PayPal creada exitosamente',
    });
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Error en createPayPalOrder:', error.message || error);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/paypal/capture
// Captura el pago después de la aprobación del cliente.
// -----------------------------------------------------------
const capturePayPalOrder = async (req, res) => {
  try {
    const { paypal_order_id, order_id, reservation_id } = req.body;

    if (!paypal_order_id) {
      return res.status(400).json({
        error: 'El campo paypal_order_id es obligatorio',
      });
    }

    // Capturar el pago
    const client = getPayPalClient();
    const request = new paypal.orders.OrdersCaptureRequest(paypal_order_id);
    request.requestBody({});

    const response = await client.execute(request);

    if (response.result.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'El pago no pudo ser completado',
      });
    }

    const capturedAmount = parseFloat(
      response.result.purchase_units[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    // Actualizar la orden o reserva
    if (order_id) {
      await pool.query(
        `UPDATE orders SET status = 'confirmed', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [order_id]
      );
    }

    if (reservation_id) {
      await pool.query(
        `UPDATE reservations SET status = 'confirmed', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [reservation_id]
      );

      // Registrar el pago
      await pool.query(
        `INSERT INTO payments
           (reservation_id, payment_method, status, total_amount,
            paid_amount, external_reference)
         VALUES ($1, 'paypal', 'paid', $2, $2, $3)`,
        [reservation_id, capturedAmount, paypal_order_id]
      );
    }

    return res.status(200).json({
      data: {
        paypal_order_id: response.result.id,
        status: response.result.status,
        amount: capturedAmount,
      },
      message: 'Pago capturado exitosamente',
    });
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('❌ Error en capturePayPalOrder:', error.message || error);
    return res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/paypal/reservation-order
// -----------------------------------------------------------
const createReservationPayPalOrder = async (req, res) => {
  try {
    const { reservation_id, payment_type } = req.body;

    if (!reservation_id || !payment_type) {
      return res.status(400).json({ error: 'reservation_id y payment_type son obligatorios' });
    }

    const resResult = await pool.query(
      `SELECT r.*, 
        s.name AS service_name, s.price::FLOAT AS service_price,
        s.deposit_amount::FLOAT AS service_deposit,
        w.name AS workshop_name, w.price::FLOAT AS workshop_price,
        w.deposit_amount::FLOAT AS workshop_deposit
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [reservation_id]
    );

    if (resResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reservation = resResult.rows[0];
    let title = reservation.service_name || reservation.workshop_name || 'Reserva';
    let amount = 0;

    if (payment_type === 'full') {
      amount = (reservation.service_price || reservation.workshop_price || 0);
      title += ' (Pago completo)';
    } else if (payment_type === 'deposit') {
      amount = (reservation.service_deposit || reservation.workshop_deposit || 0);
      if (amount === 0) {
        return res.status(400).json({ error: 'Este servicio no tiene anticipo configurado' });
      }
      title += ' (Anticipo)';
    } else {
      return res.status(400).json({ error: 'payment_type inválido' });
    }

    const client = getPayPalClient();
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: reservation_id,
          amount: {
            currency_code: 'MXN',
            value: amount.toFixed(2),
          },
          description: title,
        },
      ],
    });

    const response = await client.execute(request);

    return res.status(200).json({
      data: {
        paypal_order_id: response.result.id,
      },
      message: 'Orden de PayPal para reserva creada exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en createReservationPayPalOrder:', error.message || error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// -----------------------------------------------------------
// POST /api/v1/checkout/paypal/reservation-capture
// -----------------------------------------------------------
const captureReservationPayPal = async (req, res) => {
  try {
    const { paypal_order_id, reservation_id, payment_type, amount } = req.body;

    if (!paypal_order_id || !reservation_id) {
      return res.status(400).json({ error: 'paypal_order_id y reservation_id son obligatorios' });
    }

    const client = getPayPalClient();
    const request = new paypal.orders.OrdersCaptureRequest(paypal_order_id);
    request.requestBody({});

    const response = await client.execute(request);

    if (response.result.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'El pago no pudo ser completado' });
    }

    const capturedAmount = parseFloat(
      response.result.purchase_units[0]?.payments?.captures?.[0]?.amount?.value || '0'
    );

    // Obtener precio completo
    const resResult = await pool.query(
      `SELECT COALESCE(s.price, w.price, 0)::FLOAT AS total_price
       FROM reservations r
       LEFT JOIN services s ON s.id = r.service_id
       LEFT JOIN workshops w ON w.id = r.workshop_id
       WHERE r.id = $1`,
      [reservation_id]
    );
    
    const fullPrice = resResult.rows.length > 0 ? resResult.rows[0].total_price : capturedAmount;

    // Actualizar estado de la reserva
    await pool.query(
      `UPDATE reservations SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [reservation_id]
    );

    // Verificar si ya existe un registro de pago para esta reserva
    const payCheck = await pool.query(
      `SELECT id FROM payments WHERE reservation_id = $1 AND deleted_at IS NULL`,
      [reservation_id]
    );

    if (payCheck.rows.length > 0) {
      await pool.query(
        `UPDATE payments 
         SET payment_method = 'paypal', status = 'completed', total_amount = $1, paid_amount = $2, external_reference = $3, updated_at = NOW()
         WHERE reservation_id = $4`,
        [fullPrice, capturedAmount, paypal_order_id, reservation_id]
      );
    } else {
      await pool.query(
        `INSERT INTO payments
           (reservation_id, payment_method, status, total_amount, paid_amount, external_reference)
         VALUES ($1, 'paypal', 'completed', $2, $3, $4)`,
        [reservation_id, fullPrice, capturedAmount, paypal_order_id]
      );
    }

    return res.status(200).json({
      data: {
        paypal_order_id: response.result.id,
        status: response.result.status,
        amount: capturedAmount,
      },
      message: 'Pago de reserva capturado exitosamente',
    });
  } catch (error) {
    console.error('❌ Error en captureReservationPayPal:', error.message || error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createMPPreference,
  mpWebhook,
  createPayPalOrder,
  capturePayPalOrder,
  createReservationMPPreference,
  mpReservationWebhook,
  createReservationPayPalOrder,
  captureReservationPayPal,
};
