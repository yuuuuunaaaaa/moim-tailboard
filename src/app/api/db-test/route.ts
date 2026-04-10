import mysql from 'mysql2/promise';

export async function GET() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
    });

    const [rows] = await pool.query('SELECT 1 as test');

    return Response.json({
      success: true,
      result: rows,
    });
  } catch (err: any) {
    return Response.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}