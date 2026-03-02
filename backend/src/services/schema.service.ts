import { db } from '../config/db';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1`,
    [tableName, indexName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

export async function ensureReliabilitySchema(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS scan_events (
      scan_id VARCHAR(64) NOT NULL PRIMARY KEY,
      uid VARCHAR(255) NOT NULL,
      user_id INT NULL,
      rfid_tag_id INT NULL,
      status ENUM('received', 'validated', 'committed', 'rejected', 'error') NOT NULL,
      error_code VARCHAR(64) NULL,
      error_message VARCHAR(255) NULL,
      beer_bu_id INT NULL,
      score INT NULL,
      source VARCHAR(64) NULL,
      scanned_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS kiosk_session (
      kiosk_id VARCHAR(64) NOT NULL PRIMARY KEY,
      current_user_id INT NULL,
      expires_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('beer_bu', 'scan_id'))) {
    await db.query(`ALTER TABLE beer_bu ADD COLUMN scan_id VARCHAR(64) NULL`);
  }

  if (!(await indexExists('beer_bu', 'ux_beer_bu_scan_id'))) {
    await db.query(`CREATE UNIQUE INDEX ux_beer_bu_scan_id ON beer_bu (scan_id)`);
  }
}
