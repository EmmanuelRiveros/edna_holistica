require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');

async function test() {
  try {
    // 1. Obtener datos de un usuario cliente existente
    const [users] = await pool.query("SELECT id, email, role FROM users WHERE role = 'client' LIMIT 1");
    if (users.length === 0) {
      console.error("No se encontró ningún usuario cliente en la base de datos.");
      return;
    }
    const user = users[0];
    console.log("Cliente seleccionado:", user);

    // 2. Generar el JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log("JWT generado exitosamente");

    // 3. Realizar petición al endpoint del backend
    const url = 'http://localhost:4000/api/v1/coupons/validate?code=ITSON&total=150';
    console.log("Haciendo petición a:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    console.log("Respuesta del servidor:", response.status, data);

  } catch (err) {
    console.error("Error durante la prueba:", err);
  } finally {
    pool.end();
  }
}

test();
