// ============================================================
// db.js — Pool de conexión a PostgreSQL (Neon)
// ============================================================
// Usa un Pool en lugar de un Client individual para:
//   • Reutilizar conexiones (performance)
//   • Manejar múltiples queries concurrentes
//   • Auto-reconectar si una conexión se cierra
//
// La conexión a Neon requiere SSL (sslmode=require viene en la URL).
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requiere SSL; la URL ya incluye ?sslmode=require,
  // pero lo reforzamos aquí por si se omite en el .env.
  ssl: {
    rejectUnauthorized: false,
  },
});

// Log de conexión exitosa (solo en desarrollo)
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📦 Nueva conexión al pool de PostgreSQL');
  }
});

// Log de errores del pool para evitar crashes silenciosos
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err.message);
});

module.exports = pool;
