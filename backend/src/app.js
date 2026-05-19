// ============================================================
// app.js — Servidor Express principal
// ============================================================
// Carga .env ANTES de cualquier otro import que dependa de
// variables de entorno (como db.js).
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const servicesRoutes = require('./routes/services.routes');
const workshopsRoutes = require('./routes/workshops.routes');
const clientsRoutes = require('./routes/clients.routes');
const reservationsRoutes = require('./routes/reservations.routes');
const paymentsRoutes = require('./routes/payments.routes');
const clinicalNotesRoutes = require('./routes/clinical_notes.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const agendaRoutes = require('./routes/agenda.routes');
const availabilityRoutes = require('./routes/availability.routes');
const productsRoutes = require('./routes/products.routes');
const categoriesRoutes = require('./routes/categories.routes');
const ordersRoutes = require('./routes/orders.routes');
const couponsRoutes = require('./routes/coupons.routes');
const addressesRoutes = require('./routes/addresses.routes');
const paymentSettingsRoutes = require('./routes/payment_settings.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const therapistServicesRoutes = require('./routes/therapist_services.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------
// Middleware global
// -----------------------------------------------------------
app.use(cors({
  origin: '*', // Permite peticiones desde Vercel, el celular, localhost, etc.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());

// -----------------------------------------------------------
// Ruta: GET /health
// Verifica que el servidor está arriba Y que la conexión
// a PostgreSQL funciona. Útil para monitoreo y despliegues.
// -----------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      server_time: result.rows[0].server_time,
    });
  } catch (error) {
    console.error('❌ Health check falló:', error.message);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: error.message,
    });
  }
});

// -----------------------------------------------------------
// Rutas de la API v1
// -----------------------------------------------------------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/workshops', workshopsRoutes);
app.use('/api/v1/clients', clientsRoutes);
app.use('/api/v1/reservations', reservationsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/clinical-notes', clinicalNotesRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/agenda', agendaRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/coupons', couponsRoutes);
app.use('/api/v1/addresses', addressesRoutes);
app.use('/api/v1/payment-settings', paymentSettingsRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/therapist-services', therapistServicesRoutes);

// -----------------------------------------------------------
// Arranque del servidor
// -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

const { startReminderJob } = require('./jobs/reminders.job');
startReminderJob();
