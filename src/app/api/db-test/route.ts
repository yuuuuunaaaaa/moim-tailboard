import { pool } from "@/lib/db";

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>("SELECT 1 AS test");
    return Response.json({
      success: true,
      result: rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
