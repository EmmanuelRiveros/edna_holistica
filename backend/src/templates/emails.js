const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <style>
    body { font-family: Inter, sans-serif; 
           background: #F9FAFB; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; 
                 background: white; border-radius: 16px;
                 overflow: hidden; }
    .header { background: linear-gradient(135deg, #FF8C00, #f97316);
              padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px;
                 font-weight: 300; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .body { padding: 32px; }
    .card { background: #FFF7ED; border-radius: 12px;
            padding: 20px; margin: 16px 0; 
            border-left: 4px solid #FF8C00; }
    .btn { display: inline-block; background: #FF8C00;
           color: white; padding: 14px 28px; 
           border-radius: 50px; text-decoration: none;
           font-weight: 600; margin: 16px 0; }
    .footer { background: #1F2937; padding: 24px; 
              text-align: center; color: #9CA3AF;
              font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 24px;">
    <div class="container">
      <div class="header">
        <h1>✨ Edna Lugo Holística</h1>
        <p>Tu espacio de sanación y bienestar</p>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>© 2026 Edna Lugo Holística • Guaymas, Sonora</p>
        <p>Si no solicitaste este email, puedes ignorarlo.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const confirmationEmail = ({ clientName, serviceName, date, time, therapistName, isVirtual, zoomLink, location, reservationId }) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  let locationInfo = '';
  if (isVirtual) {
    locationInfo = zoomLink 
      ? `<p>🔗 <strong>Link de Zoom:</strong> <a href="${zoomLink}">Unirse a la sesión</a></p>`
      : `<p>🔗 <strong>Link de Zoom:</strong> Se enviará próximamente</p>`;
  } else {
    locationInfo = `<p>📍 <strong>Ubicación:</strong> ${location || 'Centro Holístico Edna Lugo'}</p>`;
  }

  const content = `
    <h2>Hola ${clientName},</h2>
    <p>¡Tu reserva está confirmada! Nos alegra mucho acompañarte en tu proceso de sanación.</p>
    
    <div class="card">
      <p>📅 <strong>Fecha:</strong> ${date}</p>
      <p>⏰ <strong>Hora:</strong> ${time}</p>
      <p>👤 <strong>Terapeuta:</strong> ${therapistName}</p>
      ${locationInfo}
    </div>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/portal/reservas" class="btn">Ver mis reservas</a>
    </div>
  `;

  return baseTemplate(content);
};

const reminder24hEmail = ({ clientName, serviceName, date, time, therapistName, isVirtual, zoomLink, instructions }) => {
  let locationInfo = '';
  if (isVirtual) {
    locationInfo = zoomLink 
      ? `<p>🔗 <strong>Link de Zoom:</strong> <a href="${zoomLink}">Unirse a la sesión</a></p>`
      : `<p>🔗 <strong>Link de Zoom:</strong> Te lo enviaremos antes de tu cita.</p>`;
  } else {
    locationInfo = `<p>📍 <strong>Instrucciones:</strong> ${instructions || 'Te esperamos con 5 minutos de anticipación.'}</p>`;
  }

  const content = `
    <h2>Hola ${clientName},</h2>
    <p>Este es un recordatorio de que tu cita de <strong>${serviceName}</strong> es mañana.</p>
    
    <div class="card">
      <p>📅 <strong>Fecha:</strong> ${date}</p>
      <p>⏰ <strong>Hora:</strong> ${time}</p>
      <p>👤 <strong>Terapeuta:</strong> ${therapistName}</p>
      ${locationInfo}
    </div>
  `;

  return baseTemplate(content);
};

const reminder2hEmail = ({ clientName, serviceName, date, time, isVirtual, zoomLink }) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  let locationInfo = '';
  if (isVirtual && zoomLink) {
    locationInfo = `
      <div style="text-align: center;">
        <a href="${zoomLink}" class="btn">Entrar a Zoom Ahora</a>
      </div>
    `;
  }

  const content = `
    <h2>Hola ${clientName},</h2>
    <p>¡Ya casi es hora! Tu cita de <strong>${serviceName}</strong> comienza en 2 horas.</p>
    
    <div class="card">
      <p>⏰ <strong>Hora:</strong> ${time}</p>
    </div>

    ${locationInfo}
  `;

  return baseTemplate(content);
};

const thankYouEmail = ({ clientName, serviceName, therapistName, reservationId }) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  const content = `
    <h2>Hola ${clientName},</h2>
    <p>Muchas gracias por tu visita a <strong>${serviceName}</strong>. Esperamos que la sesión con ${therapistName} haya sido de gran beneficio para ti.</p>
    
    <p>Nos encantaría saber cómo te fue. Tu retroalimentación nos ayuda a seguir mejorando nuestro espacio.</p>
    
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/portal/mis-ordenes" class="btn">Dejar una reseña</a>
    </div>
  `;

  return baseTemplate(content);
};

const feedbackEmail = ({ clientName, serviceName, reservationId }) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  const starStyle = "font-size: 24px; text-decoration: none; margin: 0 4px;";
  const stars = [1, 2, 3, 4, 5].map(n => 
    `<a href="${FRONTEND_URL}/portal/feedback?rating=${n}&rid=${reservationId}" style="${starStyle}">⭐</a>`
  ).join('');

  const content = `
    <h2>Hola ${clientName},</h2>
    <p>¿Cómo calificarías tu reciente sesión de <strong>${serviceName}</strong>?</p>
    
    <div style="text-align: center; margin: 24px 0;">
      ${stars}
    </div>
    
    <p style="text-align: center; color: #6B7280; font-size: 14px;">
      Haz clic en una estrella para dejarnos tu opinión.
    </p>
  `;

  return baseTemplate(content);
};

module.exports = {
  confirmationEmail,
  reminder24hEmail,
  reminder2hEmail,
  thankYouEmail,
  feedbackEmail
};
