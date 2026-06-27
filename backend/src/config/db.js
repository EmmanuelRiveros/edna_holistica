// ============================================================
// db.js — Pool de conexión a MySQL / MariaDB (mysql2)
// ============================================================
// Usa un Pool en lugar de una conexión individual para:
//   • Reutilizar conexiones (performance)
//   • Manejar múltiples queries concurrentes
//   • Auto-reconectar si una conexión se cierra
//
// decimalNumbers: true  →  las columnas DECIMAL/NUMERIC
// llegan como number de JS en vez de string.
// ============================================================

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  // decimalNumbers: true para que los DECIMAL/NUMERIC lleguen como number
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Log de conexión exitosa (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  pool.getConnection()
    .then((conn) => {
      console.log('📦 Conexión al pool de MySQL/MariaDB verificada');
      conn.release();
    })
    .catch((err) => {
      console.error('❌ Error conectando al pool de MySQL/MariaDB:', err.message);
    });
}

module.exports = pool;
