require('dotenv').config();
const pool = require('../src/config/db');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE reservations 
      ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT FALSE;
      
      ALTER TABLE reservations 
      ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✅ Columnas de recordatorios agregadas a la base de datos');
  } catch (err) {
    console.error('❌ Error alterando la tabla:', err);
  } finally {
    pool.end();
  }
}

run();
