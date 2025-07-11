require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

// Test the connection with a simple query
(async () => {
  try {
    await sql`SELECT 1`; // Lightweight test query
    console.log("Neon PostgreSQL connected successfully!");
  } catch (err) {
    console.error("Error connecting to Neon PostgreSQL:", err.message);
    process.exit(1);
  }
})();

module.exports = sql;
