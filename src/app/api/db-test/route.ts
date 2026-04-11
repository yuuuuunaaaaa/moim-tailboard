export const runtime = 'nodejs';

import mysql from 'mysql2/promise';

export async function GET() {
  try {
    console.log("ENV CHECK:", {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      db: process.env.DB_NAME,
    });

    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
    });

    const [rows] = await pool.query('SELECT 1 as test');

    return Response.json({
      success: true,
      rows,
    });
  } catch (err: any) {
    console.error("DB ERROR:", err);

    return Response.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
