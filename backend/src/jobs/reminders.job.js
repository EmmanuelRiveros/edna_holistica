const cron = require('node-cron');
const pool = require('../config/db');
const emailService = require('../services/email.service');

// Ejecutar cada hora
const startReminderJob = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('🔔 Verificando recordatorios pendientes...');
    
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const tolerance = 30 * 60 * 1000; // 30 min de tolerancia

    try {
      // Reservas en ~24 horas
      const reservations24h = await pool.query(
        `SELECT id FROM reservations
         WHERE status = 'confirmed'
           AND deleted_at IS NULL
           AND scheduled_at BETWEEN $1 AND $2
           AND reminder_24h_sent = FALSE`,
        [
          new Date(in24h.getTime() - tolerance),
          new Date(in24h.getTime() + tolerance)
        ]
      );

      for (const r of reservations24h.rows) {
        await emailService.sendNotification({ type: 'reminder_24h', data: r.id });
        await pool.query(
          'UPDATE reservations SET reminder_24h_sent = TRUE WHERE id = $1',
          [r.id]
        );
      }

      // Reservas en ~2 horas
      const reservations2h = await pool.query(
        `SELECT id FROM reservations
         WHERE status = 'confirmed'
           AND deleted_at IS NULL
           AND scheduled_at BETWEEN $1 AND $2
           AND reminder_2h_sent = FALSE`,
        [
          new Date(in2h.getTime() - tolerance),
          new Date(in2h.getTime() + tolerance)
        ]
      );

      for (const r of reservations2h.rows) {
        await emailService.sendNotification({ type: 'reminder_2h', data: r.id });
        await pool.query(
          'UPDATE reservations SET reminder_2h_sent = TRUE WHERE id = $1',
          [r.id]
        );
      }
    } catch (error) {
      console.error('❌ Error en el job de recordatorios:', error.message);
    }
  });
  
  console.log('🔔 Sistema de recordatorios iniciado');
};

module.exports = { startReminderJob };
