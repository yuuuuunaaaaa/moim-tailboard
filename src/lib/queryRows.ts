import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { pool } from "./db";

/**
 * 반복되던 `const [rows] = await pool.query<any[]>(...); return rows as T[]`
 * 패턴을 한 곳에 모아 타입 안전한 래퍼로 제공한다.
 *
 * 전체 파일에 흩어져 있던 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`와
 * `as any[]` 캐스팅을 제거하는 것이 목적이다.
 */

type QueryExecutor = Pool | PoolConnection;

// 결과 행 타입은 보통 명시적 인터페이스(`Tenant`, `Event` 등)다.
// `Record<string, unknown>`은 인덱스 시그니처가 없는 타입을 거부하므로 `object`로 둔다.
type Row = object;

type QueryValues = Parameters<QueryExecutor["query"]>[1];

async function runQuery(
  executor: QueryExecutor,
  sql: string,
  values: QueryValues,
): Promise<unknown> {
  return values === undefined ? executor.query(sql) : executor.query(sql, values);
}

/** SELECT 결과 행 목록을 T[]로 반환. */
export async function queryRows<T extends Row = Row>(
  sql: string,
  values?: QueryValues,
  executor: QueryExecutor = pool,
): Promise<T[]> {
  const result = (await runQuery(executor, sql, values)) as [T[], unknown];
  return result[0];
}

/** 첫 행 또는 null. LIMIT 1 쿼리에 사용. */
export async function queryFirst<T extends Row = Row>(
  sql: string,
  values?: QueryValues,
  executor: QueryExecutor = pool,
): Promise<T | null> {
  const rows = await queryRows<T>(sql, values, executor);
  return rows[0] ?? null;
}

/** INSERT/UPDATE/DELETE 실행 결과(ResultSetHeader) 반환. */
export async function execute(
  sql: string,
  values?: QueryValues,
  executor: QueryExecutor = pool,
): Promise<ResultSetHeader> {
  const result = (await runQuery(executor, sql, values)) as [ResultSetHeader, unknown];
  return result[0];
}

/** PoolConnection에 묶인 query executor 뷰를 만든다. 트랜잭션용. */
export function boundTo(conn: PoolConnection): {
  rows: <T extends Row = Row>(sql: string, values?: QueryValues) => Promise<T[]>;
  first: <T extends Row = Row>(sql: string, values?: QueryValues) => Promise<T | null>;
  exec: (sql: string, values?: QueryValues) => Promise<ResultSetHeader>;
} {
  return {
    rows: <T extends Row = Row>(sql: string, values?: QueryValues) =>
      queryRows<T>(sql, values, conn),
    first: <T extends Row = Row>(sql: string, values?: QueryValues) =>
      queryFirst<T>(sql, values, conn),
    exec: (sql: string, values?: QueryValues) => execute(sql, values, conn),
  };
}
