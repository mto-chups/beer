import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
});

export async function testDbConnection(): Promise<void> {
  const connection = await db.getConnection();

  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
