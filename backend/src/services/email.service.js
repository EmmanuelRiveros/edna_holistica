const resend = require('../config/resend');
const templates = require('../templates/emails');
const pool = require('../config/db');

// Helper para construir datos completos de la reserva
const buildReservationData = async (reservationId) => {
  const result = await pool.query(
    `SELECT 
       r.id, r.scheduled_at, r.status,
       u.first_name AS client_first_name,
       u.last_name AS client_last_name,
       u.email AS client_email,
       t.first_name AS therapist_first_name,
       t.last_name AS therapist_last_name,
       s.name AS service_name,
       s.duration_minutes,
       w.name AS workshop_name,
       w.type AS workshop_type
     FROM reservations r
     JOIN users u ON u.id = r.client_id
     LEFT JOIN users t ON t.id = r.therapist_id
     LEFT JOIN services s ON s.id = r.service_id
     LEFT JOIN workshops w ON w.id = r.workshop_id
     WHERE r.id = $1`,
    [reservationId]
  );

  if (result.rows.length === 0) {
    throw new Error('Reserva no encontrada');
  }

  const row = result.rows[0];
  const isVirtual = row.workshop_type === 'virtual';

  return {
    clientName: row.client_first_name,
    clientEmail: row.client_email,
    serviceName: row.service_name || row.workshop_name,
    therapistName: `${row.therapist_first_name || ''} ${row.therapist_last_name || ''}`.trim() || 'No asignado',
    date: new Date(row.scheduled_at).toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric',
      month: 'long', day: 'numeric'
    }),
    time: new Date(row.scheduled_at).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit'
    }),
    isVirtual,
    zoomLink: null, // Se agregará cuando Edna tenga Zoom
    reservationId: row.id,
    instructions: null
  };
};

const emailService = {

  // Enviar confirmación de reserva
  sendConfirmation: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `✅ Tu cita está confirmada — ${data.serviceName}`,
        html: templates.confirmationEmail(data)
      });

      console.log(`✅ Email de confirmación enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de confirmación:', error.message);
    }
  },

  // Enviar aviso de cancelación
  sendCancellation: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `❌ Cita cancelada — ${data.serviceName}`,
        html: templates.cancellationEmail(data)
      });

      console.log(`✅ Email de cancelación enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de cancelación:', error.message);
    }
  },

  sendReminder24h: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `⏰ Recordatorio: Tu cita es mañana`,
        html: templates.reminder24hEmail(data)
      });

      console.log(`✅ Email de recordatorio (24h) enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de recordatorio 24h:', error.message);
    }
  },

  sendReminder2h: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `🔔 Tu cita es en 2 horas`,
        html: templates.reminder2hEmail(data)
      });

      console.log(`✅ Email de recordatorio (2h) enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de recordatorio 2h:', error.message);
    }
  },

  sendThankYou: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `🙏 Gracias por tu visita — ${data.serviceName}`,
        html: templates.thankYouEmail(data)
      });

      console.log(`✅ Email de agradecimiento enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de agradecimiento:', error.message);
    }
  },

  sendFeedbackRequest: async (reservationId) => {
    try {
      const data = await buildReservationData(reservationId);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data.clientEmail,
        subject: `⭐ ¿Cómo fue tu sesión de ${data.serviceName}?`,
        html: templates.feedbackEmail(data)
      });

      console.log(`✅ Email de feedback enviado a ${data.clientEmail}`);
    } catch (error) {
      console.error('❌ Error enviando email de feedback:', error.message);
    }
  },

  // Método preparado para push notifications futuras
  sendNotification: async ({ type, userId, data }) => {
    // Por ahora solo email
    // En el futuro: if (user.push_token) sendPushNotification(...)
    switch (type) {
      case 'confirmation': return emailService.sendConfirmation(data);
      case 'cancellation': return emailService.sendCancellation(data);
      case 'reminder_24h': return emailService.sendReminder24h(data);
      case 'reminder_2h': return emailService.sendReminder2h(data);
      case 'thank_you': return emailService.sendThankYou(data);
      case 'feedback': return emailService.sendFeedbackRequest(data);
      default:
        console.warn(`Tipo de notificación desconocido: ${type}`);
    }
  }
};

module.exports = emailService;
