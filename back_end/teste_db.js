process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  },
});


(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Conectado ao PostgreSQL Neon!");
    const res = await client.query("SELECT NOW()");
    console.log("🕒 Data do servidor:", res.rows[0]);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao conectar:", err.message);
    process.exit(1);
  }
})();
