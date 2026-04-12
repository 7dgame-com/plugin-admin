import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const connectionLimit = Number(process.env.PLUGIN_DB_CONNECTION_LIMIT ?? 10);

export const pluginPool: Pool = mysql.createPool({
  host: process.env.PLUGIN_DB_HOST || 'localhost',
  port: Number(process.env.PLUGIN_DB_PORT || 3306),
  database: process.env.PLUGIN_DB_NAME || 'bujiaban_plugin',
  user: process.env.PLUGIN_DB_USER || 'root',
  password: process.env.PLUGIN_DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 10,
});

export type QueryRow = RowDataPacket & Record<string, unknown>;
export type MutationResult = ResultSetHeader;

export async function pingPluginDb(): Promise<void> {
  let connection: PoolConnection | null = null;

  try {
    connection = await pluginPool.getConnection();
    await connection.ping();
  } finally {
    connection?.release();
  }
}

export async function probePluginDb(): Promise<void> {
  await pluginPool.query('SELECT 1 AS ok');
}
